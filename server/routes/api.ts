import { Router, Request, Response } from 'express';
import { db, isDatabaseConnected, getDbStatus } from '../../src/db/index.ts';
import {
  users,
  counselingRequests,
  requestMessages,
  counselingNotes,
  counselingAppointments,
  educationalResources,
  bullyingReports,
  emotionCheckins,
  auditLogs,
} from '../../src/db/schema.ts';
import { eq, desc, and, or, sql, like } from 'drizzle-orm';
import {
  requireAuth,
  requireRoles,
  AuthenticatedRequest,
  rateLimit,
  trackFailedLookup,
  isLookupBlocked,
  resetLookupFailure,
} from '../middleware.ts';
import { askCompanionAI } from '../gemini.ts';
import {
  createSignedToken,
  generateSecureTicketCode,
  hashSecretCode,
  sanitizeText,
  isValidDateString,
  isValidTimeString,
} from '../security.ts';
import { devStore } from '../devStore.ts';

export const apiRouter = Router();

// Helper to write sanitized audit logs
async function addAuditLog(username: string, actionType: string, targetResource: string, details?: string) {
  if (isDatabaseConnected()) {
    try {
      await db.insert(auditLogs).values({
        username: sanitizeText(username) || 'ANONYMOUS',
        actionType,
        targetResource: sanitizeText(targetResource),
        details: details ? sanitizeText(details) : null,
      });
    } catch (err) {
      console.error('[AUDIT_ERROR] Failed to write audit log:', err);
    }
  } else {
    devStore.addAuditLog(username, actionType, targetResource, details);
  }
}

// ==========================================
// 0. SYSTEM HEALTH & DATABASE MODE STATUS
// ==========================================

apiRouter.get('/system/status', (req: Request, res: Response) => {
  const isConnected = isDatabaseConnected();
  const dbStatus = getDbStatus();
  return res.json({
    success: true,
    isProduction: process.env.NODE_ENV === 'production',
    database: {
      connected: isConnected,
      mode: isConnected ? 'postgres' : 'in-memory-dev',
      source: dbStatus.connectionSource,
      message: isConnected
        ? 'Đã kết nối cơ sở dữ liệu PostgreSQL thực tế.'
        : '⚠️ Đang chạy ở chế độ xem trước giao diện (No-Database Mode). Dữ liệu chỉ lưu tạm trong bộ nhớ RAM và KHÔNG lưu vào hệ thống thực tế.',
    },
  });
});

// ==========================================
// 1. AUTHENTICATION & SESSIONS
// ==========================================

apiRouter.post('/auth/login', rateLimit(10, 60000), async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tên đăng nhập hợp lệ.' });
  }

  const cleanUsername = sanitizeText(username).trim();

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const devTargetUser = devStore.findUser(cleanUsername);
    if (!devTargetUser || !devTargetUser.isActive) {
      return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không chính xác hoặc tài khoản đã bị khóa.' });
    }

    const token = createSignedToken(devTargetUser.uid, devTargetUser.role);
    devStore.addAuditLog(devTargetUser.uid, 'LOGIN', 'USER_SESSION', `Đăng nhập thử nghiệm với vai trò ${devTargetUser.role}`);

    return res.json({
      success: true,
      token,
      isDemoMode: true,
      user: {
        id: devTargetUser.id,
        uid: devTargetUser.uid,
        email: devTargetUser.email,
        fullName: devTargetUser.fullName,
        role: devTargetUser.role,
        gradeLevel: devTargetUser.gradeLevel,
      },
    });
  }

  // Mode: Real PostgreSQL
  try {
    const aliasMap: Record<string, string> = {
      'hocsinh.an': 'usr-student-1',
      'hocsinh.binh': 'usr-student-2',
      'tuvan.tuananh': 'usr-counselor-1',
      'tuvan.thuytrang': 'usr-counselor-2',
      'thuytrang': 'usr-counselor-2',
      'cotrang': 'usr-counselor-2',
      'c2phuochungap_trang': 'usr-counselor-2',
      'c2phuochungap_trang@angiang.edu.vn': 'usr-counselor-2',
      'thuytrang.nguyen@school.edu.vn': 'usr-counselor-2',
      'thuytrang.nguyen@truonghoc.edu.vn': 'usr-counselor-2',
      'gvcn.lan': 'usr-teacher-1',
      'phuhuynh.mai': 'usr-parent-1',
      'quantri.minh': 'usr-admin-1',
      'quantri.minh@school.edu.vn': 'usr-admin-1',
      'bgh': 'usr-admin-1',
      'hocsinh': 'usr-student-1',
      'student': 'usr-student-1',
      'tuvan': 'usr-counselor-1',
      'counselor': 'usr-counselor-1',
      'gvcn': 'usr-teacher-1',
      'teacher': 'usr-teacher-1',
      'phuhuynh': 'usr-parent-1',
      'parent': 'usr-parent-1',
      'quantri': 'usr-admin-1',
      'admin': 'usr-admin-1',
    };

    const targetUid = aliasMap[cleanUsername.toLowerCase()] || cleanUsername;

    const matchingUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.uid, targetUid), eq(users.uid, cleanUsername), eq(users.email, cleanUsername)))
      .limit(1);

    let targetUser = matchingUsers[0];

    if (!targetUser) {
      const prefixUser = await db
        .select()
        .from(users)
        .where(
          like(
            users.uid,
            `%${cleanUsername
              .replace('hocsinh.', 'usr-student-')
              .replace('tuvan.', 'usr-counselor-')
              .replace('gvcn.', 'usr-teacher-')
              .replace('phuhuynh.', 'usr-parent-')
              .replace('quantri.', 'usr-admin-')}%`
          )
        )
        .limit(1);

      if (prefixUser.length > 0) {
        targetUser = prefixUser[0];
      }
    }

    if (!targetUser || !targetUser.isActive) {
      return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không chính xác hoặc tài khoản đã bị khóa.' });
    }

    const token = createSignedToken(targetUser.uid, targetUser.role);
    await addAuditLog(targetUser.uid, 'LOGIN', 'USER_SESSION', `Đăng nhập thành công với vai trò ${targetUser.role}`);

    return res.json({
      success: true,
      token,
      user: {
        id: targetUser.id,
        uid: targetUser.uid,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        gradeLevel: targetUser.gradeLevel,
      },
    });
  } catch (err) {
    console.error('[AUTH_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý đăng nhập.' });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  return res.json({
    success: true,
    user: {
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      gradeLevel: u.gradeLevel,
    },
  });
});

apiRouter.get('/auth/demo-users', async (req: Request, res: Response) => {
  if (!isDatabaseConnected()) {
    return res.json({ success: true, users: devStore.getUsers(), isDemoMode: true });
  }

  try {
    const list = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        gradeLevel: users.gradeLevel,
        phoneNumber: users.phoneNumber,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.isActive, true));

    return res.json({ success: true, users: list });
  } catch (err) {
    console.error('[USERS_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách người dùng.' });
  }
});

// ==========================================
// 2. COUNSELING REQUESTS (GÓC CHIA SẺ)
// ==========================================

apiRouter.post('/counseling/request', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const {
    gradeLevel,
    topic,
    isAnonymous,
    studentAlias,
    studentClass,
    contactMethod,
    contactValue,
    preferredTime,
    content,
    privacyAgreed,
  } = req.body;

  if (!topic || !content || !contactMethod) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền đầy đủ chủ đề, nội dung chia sẻ và kênh liên hệ an toàn.',
    });
  }

  if (!privacyAgreed) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng xác nhận bạn đã đọc và đồng ý với chính sách bảo mật thông tin.',
    });
  }

  const cleanContent = sanitizeText(content).trim();
  if (cleanContent.length < 5 || cleanContent.length > 3000) {
    return res.status(400).json({
      success: false,
      message: 'Nội dung chia sẻ phải có độ dài từ 5 đến 3000 ký tự.',
    });
  }

  const requestCode = generateSecureTicketCode('GLN');
  const cleanAlias = sanitizeText(studentAlias) || (isAnonymous ? 'Học sinh ẩn danh' : 'Em học sinh');
  const cleanClass = sanitizeText(studentClass) || null;
  const cleanContactMethod = sanitizeText(contactMethod);
  const cleanContactValue = sanitizeText(contactValue) || null;
  const cleanPreferredTime = sanitizeText(preferredTime) || 'Giờ ra chơi hoặc sau giờ học';

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const newReq = devStore.createRequest({
      requestCode,
      gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
      topic: sanitizeText(topic),
      isAnonymous: !!isAnonymous,
      studentAlias: cleanAlias,
      studentClass: cleanClass,
      contactMethod: cleanContactMethod,
      contactValue: cleanContactValue,
      preferredTime: cleanPreferredTime,
      content: cleanContent,
      status: 'RECEIVED',
      urgencyLevel: 'NORMAL',
      privacyAgreed: true,
    });

    devStore.addAuditLog(cleanAlias, 'SUBMIT_REQUEST', requestCode, 'Gửi phiếu chia sẻ (Chế độ xem trước In-Memory)');

    return res.status(201).json({
      success: true,
      isDemoMode: true,
      isEphemeral: true,
      message: 'Phiếu chia sẻ của em đã được tiếp nhận trên giao diện thử nghiệm. [CHÚ Ý]: Hệ thống đang ở chế độ phát triển không database, dữ liệu KHÔNG được lưu vào cơ sở dữ liệu thực tế.',
      requestCode: newReq.requestCode,
      request: {
        requestCode: newReq.requestCode,
        status: newReq.status,
        createdAt: newReq.createdAt,
      },
    });
  }

  // Mode: Real PostgreSQL
  try {
    const inserted = await db
      .insert(counselingRequests)
      .values({
        requestCode,
        gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
        topic: sanitizeText(topic),
        isAnonymous: !!isAnonymous,
        studentAlias: cleanAlias,
        studentClass: cleanClass,
        contactMethod: cleanContactMethod,
        contactValue: cleanContactValue,
        preferredTime: cleanPreferredTime,
        content: cleanContent,
        status: 'RECEIVED',
        urgencyLevel: 'NORMAL',
        privacyAgreed: true,
      })
      .returning();

    const newRequest = inserted[0];
    await addAuditLog(cleanAlias, 'SUBMIT_REQUEST', requestCode, 'Gửi phiếu chia sẻ mới');

    return res.status(201).json({
      success: true,
      message: 'Phiếu chia sẻ của em đã được tiếp nhận an toàn và bảo mật.',
      requestCode: newRequest.requestCode,
      request: {
        requestCode: newRequest.requestCode,
        status: newRequest.status,
        createdAt: newRequest.createdAt,
      },
    });
  } catch (err) {
    console.error('[REQUEST_SUBMIT_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi lưu phiếu. Vui lòng thử lại.' });
  }
});

// Confidential tracking lookup by code
apiRouter.get('/counseling/track/:code', rateLimit(25, 60000), async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isLookupBlocked(ip)) {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử tra cứu sai quá nhiều lần. Vì lý do bảo mật, địa chỉ IP này tạm thời bị khóa trong 10 phút.',
    });
  }

  const rawCode = req.params.code || '';
  const code = sanitizeText(rawCode).trim().toUpperCase();

  if (!code || code.length < 5) {
    trackFailedLookup(ip);
    return res.status(400).json({ success: false, message: 'Mã tra cứu không hợp lệ.' });
  }

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const devReq = devStore.findRequestByCode(code);
    if (!devReq) {
      const isBlockedNow = trackFailedLookup(ip);
      return res.status(404).json({
        success: false,
        message: isBlockedNow
          ? 'Mã không tồn tại. Bạn đã bị tạm khóa 10 phút do thử nhiều lần.'
          : 'Không tìm thấy phiếu tư vấn với mã tra cứu này. Vui lòng kiểm tra lại mã chính xác.',
      });
    }

    resetLookupFailure(ip);
    const messages = devStore.getMessages(code);

    return res.json({
      success: true,
      isDemoMode: true,
      data: {
        requestCode: devReq.requestCode,
        topic: devReq.topic,
        gradeLevel: devReq.gradeLevel,
        status: devReq.status,
        studentAlias: devReq.studentAlias,
        preferredTime: devReq.preferredTime,
        contactMethod: devReq.contactMethod,
        content: devReq.content,
        createdAt: devReq.createdAt,
        updatedAt: devReq.updatedAt,
        messages,
      },
    });
  }

  // Mode: Real PostgreSQL
  try {
    const found = await db
      .select()
      .from(counselingRequests)
      .where(eq(counselingRequests.requestCode, code))
      .limit(1);

    if (found.length === 0) {
      const isBlockedNow = trackFailedLookup(ip);
      return res.status(404).json({
        success: false,
        message: isBlockedNow
          ? 'Mã không tồn tại. Bạn đã bị tạm khóa 10 phút do thử nhiều lần.'
          : 'Không tìm thấy phiếu tư vấn với mã tra cứu này. Vui lòng kiểm tra lại mã chính xác.',
      });
    }

    resetLookupFailure(ip);
    const request = found[0];

    const messages = await db
      .select({
        id: requestMessages.id,
        senderType: requestMessages.senderType,
        senderName: requestMessages.senderName,
        message: requestMessages.message,
        createdAt: requestMessages.createdAt,
      })
      .from(requestMessages)
      .where(eq(requestMessages.requestCode, code))
      .orderBy(requestMessages.createdAt);

    return res.json({
      success: true,
      data: {
        requestCode: request.requestCode,
        topic: request.topic,
        gradeLevel: request.gradeLevel,
        status: request.status,
        studentAlias: request.studentAlias,
        preferredTime: request.preferredTime,
        contactMethod: request.contactMethod,
        content: request.content,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        messages,
      },
    });
  } catch (err) {
    console.error('[TRACK_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tra cứu phiếu.' });
  }
});

// Student post follow-up message to a tracking ticket
apiRouter.post('/counseling/track/:code/message', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const code = sanitizeText(req.params.code).trim().toUpperCase();
  const { message, senderName } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
  }

  const cleanMessage = sanitizeText(message).trim();
  const cleanSender = sanitizeText(senderName).trim() || 'Em học sinh';

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const devReq = devStore.findRequestByCode(code);
    if (!devReq) {
      return res.status(404).json({ success: false, message: 'Phiếu không tồn tại.' });
    }

    const newMsg = devStore.addMessage(code, 'STUDENT', cleanSender, cleanMessage);
    if (devReq.status === 'RESOLVED' || devReq.status === 'CLOSED') {
      devStore.updateRequestStatus(code, 'WAITING_FEEDBACK');
    }
    devStore.addAuditLog(cleanSender, 'SEND_MESSAGE', code, 'Gửi phản hồi bổ sung (Dev Mode)');

    return res.json({ success: true, message: newMsg, isDemoMode: true });
  }

  // Mode: Real PostgreSQL
  try {
    const found = await db
      .select()
      .from(counselingRequests)
      .where(eq(counselingRequests.requestCode, code))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ success: false, message: 'Phiếu không tồn tại.' });
    }

    const request = found[0];

    const inserted = await db
      .insert(requestMessages)
      .values({
        requestId: request.id,
        requestCode: code,
        senderType: 'STUDENT',
        senderName: cleanSender,
        message: cleanMessage,
      })
      .returning();

    if (request.status === 'RESOLVED' || request.status === 'CLOSED') {
      await db
        .update(counselingRequests)
        .set({ status: 'WAITING_FEEDBACK', updatedAt: new Date() })
        .where(eq(counselingRequests.id, request.id));
    }

    await addAuditLog(cleanSender, 'SEND_MESSAGE', code, 'Gửi phản hồi bổ sung');

    return res.json({ success: true, message: inserted[0] });
  } catch (err) {
    console.error('[MSG_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn.' });
  }
});

// Staff list of requests
apiRouter.get(
  '/counseling/requests',
  requireAuth,
  requireRoles('COUNSELOR', 'TEACHER', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;

    // Mode: In-Memory Dev Mode
    if (!isDatabaseConnected()) {
      let list = devStore.listRequests();
      if (user.role === 'TEACHER') {
        const teacherGrade = user.gradeLevel || 'SECONDARY';
        list = list.filter((r) => r.gradeLevel === teacherGrade || r.gradeLevel === 'GENERAL');
      }
      return res.json({ success: true, requests: list, isDemoMode: true });
    }

    // Mode: Real PostgreSQL
    try {
      let query = db.select().from(counselingRequests);

      if (user.role === 'TEACHER') {
        const teacherGrade = user.gradeLevel || 'SECONDARY';
        const list = await query
          .where(or(eq(counselingRequests.gradeLevel, teacherGrade), eq(counselingRequests.gradeLevel, 'GENERAL')))
          .orderBy(desc(counselingRequests.createdAt));
        return res.json({ success: true, requests: list });
      }

      const list = await query.orderBy(desc(counselingRequests.createdAt));
      return res.json({ success: true, requests: list });
    } catch (err) {
      console.error('[STAFF_REQUESTS_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tải danh sách hồ sơ.' });
    }
  }
);

// Update request status, counselor assignment, or outward counselor reply
apiRouter.patch(
  '/counseling/requests/:id',
  requireAuth,
  requireRoles('COUNSELOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const rawId = req.params.id;
    const { status, urgencyLevel, assignedCounselorId, counselorReply } = req.body;

    // Mode: In-Memory Dev Mode
    if (!isDatabaseConnected()) {
      const updated = devStore.updateRequestStatus(rawId, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ yêu cầu.' });
      }

      if (counselorReply && typeof counselorReply === 'string' && counselorReply.trim()) {
        devStore.addMessage(updated.requestCode, 'COUNSELOR', req.user!.fullName, sanitizeText(counselorReply).trim());
      }

      devStore.addAuditLog(req.user!.uid, 'UPDATE_REQUEST', updated.requestCode, `Trạng thái: ${status || 'Không đổi'} (Dev Mode)`);
      return res.json({ success: true, request: updated, isDemoMode: true });
    }

    // Mode: Real PostgreSQL
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ không hợp lệ.' });
    }

    try {
      const existing = await db
        .select()
        .from(counselingRequests)
        .where(eq(counselingRequests.id, id))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ yêu cầu.' });
      }

      const request = existing[0];
      const updates: any = { updatedAt: new Date() };

      if (status) updates.status = sanitizeText(status);
      if (urgencyLevel) updates.urgencyLevel = sanitizeText(urgencyLevel);
      if (assignedCounselorId !== undefined) updates.assignedCounselorId = sanitizeText(assignedCounselorId);

      await db.update(counselingRequests).set(updates).where(eq(counselingRequests.id, id));

      if (counselorReply && typeof counselorReply === 'string' && counselorReply.trim()) {
        const cleanReply = sanitizeText(counselorReply).trim();
        await db.insert(requestMessages).values({
          requestId: id,
          requestCode: request.requestCode,
          senderType: 'COUNSELOR',
          senderName: req.user!.fullName,
          message: cleanReply,
        });
      }

      const updated = await db
        .select()
        .from(counselingRequests)
        .where(eq(counselingRequests.id, id))
        .limit(1);

      await addAuditLog(req.user!.uid, 'UPDATE_REQUEST', request.requestCode, `Trạng thái: ${status || 'Không đổi'}`);

      return res.json({ success: true, request: updated[0] });
    } catch (err) {
      console.error('[UPDATE_REQ_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ.' });
    }
  }
);

// Clinical internal notes
apiRouter.get(
  '/counseling/requests/:id/notes',
  requireAuth,
  requireRoles('COUNSELOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const rawId = req.params.id;

    if (!isDatabaseConnected()) {
      const notes = devStore.getRequestNotes(rawId);
      return res.json({ success: true, notes, isDemoMode: true });
    }

    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ không hợp lệ.' });
    }

    try {
      const notes = await db
        .select()
        .from(counselingNotes)
        .where(eq(counselingNotes.requestId, id))
        .orderBy(desc(counselingNotes.createdAt));

      return res.json({ success: true, notes });
    } catch (err) {
      console.error('[NOTES_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tải ghi chú chuyên môn.' });
    }
  }
);

apiRouter.post(
  '/counseling/requests/:id/notes',
  requireAuth,
  requireRoles('COUNSELOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const rawId = req.params.id;
    const { actionTaken, noteContent } = req.body;
    if (!noteContent || typeof noteContent !== 'string' || !noteContent.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung ghi chú nghiệp vụ không được để trống.' });
    }

    if (!isDatabaseConnected()) {
      const note = devStore.addRequestNote(rawId, req.user!.uid, sanitizeText(noteContent), actionTaken ? sanitizeText(actionTaken) : undefined);
      devStore.addAuditLog(req.user!.uid, 'CREATE_CLINICAL_NOTE', rawId, 'Thêm ghi chú đánh giá nghiệp vụ (Dev Mode)');
      return res.status(201).json({ success: true, note, isDemoMode: true });
    }

    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ không hợp lệ.' });
    }

    try {
      const inserted = await db
        .insert(counselingNotes)
        .values({
          requestId: id,
          authorId: req.user!.uid,
          authorName: req.user!.fullName,
          isPrivate: true,
          actionTaken: actionTaken ? sanitizeText(actionTaken) : null,
          noteContent: sanitizeText(noteContent),
        })
        .returning();

      await addAuditLog(req.user!.uid, 'CREATE_CLINICAL_NOTE', String(id), 'Thêm ghi chú đánh giá nghiệp vụ');

      return res.status(201).json({ success: true, note: inserted[0] });
    } catch (err) {
      console.error('[NOTE_CREATE_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi lưu ghi chú.' });
    }
  }
);

// ==========================================
// 3. APPOINTMENTS (ĐẶT LỊCH TƯ VẤN)
// ==========================================

apiRouter.get('/appointments', async (req: Request, res: Response) => {
  if (!isDatabaseConnected()) {
    const list = devStore.listAppointments().map((a) => ({
      id: a.id,
      appointmentCode: a.appointmentCode,
      counselorId: a.counselorId,
      counselorName: a.counselorName,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      location: a.location,
      format: a.format,
      status: a.status,
      reasonTopic: a.reasonTopic,
    }));
    return res.json({ success: true, appointments: list, isDemoMode: true });
  }

  try {
    const list = await db
      .select({
        id: counselingAppointments.id,
        appointmentCode: counselingAppointments.appointmentCode,
        counselorId: counselingAppointments.counselorId,
        counselorName: counselingAppointments.counselorName,
        date: counselingAppointments.date,
        startTime: counselingAppointments.startTime,
        endTime: counselingAppointments.endTime,
        location: counselingAppointments.location,
        format: counselingAppointments.format,
        status: counselingAppointments.status,
        reasonTopic: counselingAppointments.reasonTopic,
      })
      .from(counselingAppointments)
      .orderBy(counselingAppointments.date, counselingAppointments.startTime);

    return res.json({ success: true, appointments: list });
  } catch (err) {
    console.error('[APPOINTMENTS_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải lịch hẹn.' });
  }
});

apiRouter.get(
  '/appointments/staff',
  requireAuth,
  requireRoles('COUNSELOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, appointments: devStore.listAppointments(), isDemoMode: true });
    }

    try {
      const list = await db
        .select()
        .from(counselingAppointments)
        .orderBy(desc(counselingAppointments.date));

      return res.json({ success: true, appointments: list });
    } catch (err) {
      console.error('[STAFF_APPT_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tải lịch hẹn chi tiết.' });
    }
  }
);

apiRouter.post('/appointments', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const {
    counselorId,
    studentName,
    studentContact,
    date,
    startTime,
    endTime,
    format,
    reasonTopic,
    privateNotes,
  } = req.body;

  if (!date || !startTime || !endTime || !reasonTopic || !studentName) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin: ngày, giờ bắt đầu, giờ kết thúc, chủ đề và người tham gia.',
    });
  }

  if (!isValidDateString(date)) {
    return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (yêu cầu YYYY-MM-DD).' });
  }

  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    return res.status(400).json({ success: false, message: 'Định dạng thời gian không hợp lệ (yêu cầu HH:mm).' });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ success: false, message: 'Giờ bắt đầu phải trước giờ kết thúc.' });
  }

  const targetCounselorId = sanitizeText(counselorId) || 'usr-counselor-01';
  const cleanStudentName = sanitizeText(studentName).trim();
  const cleanContact = studentContact ? sanitizeText(studentContact).trim() : null;
  const cleanNotes = privateNotes ? sanitizeText(privateNotes).trim() : null;
  const code = generateSecureTicketCode('LICH');

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const counselorUser = devStore.findUser(targetCounselorId);
    const counselorName = counselorUser ? counselorUser.fullName : 'ThS. Nguyễn Tuấn Anh';

    const newApt = devStore.createAppointment({
      appointmentCode: code,
      counselorId: targetCounselorId,
      counselorName,
      studentName: cleanStudentName,
      studentId: null,
      date,
      startTime,
      endTime,
      format: (sanitizeText(format) as any) || 'IN_PERSON',
      location:
        format === 'PRIVATE_ONLINE'
          ? 'Kênh trực tuyến an toàn'
          : 'Phòng Tư vấn Tâm lý Học đường (P.204)',
      reasonTopic: sanitizeText(reasonTopic),
      status: 'SCHEDULED',
    });

    devStore.addAuditLog(cleanStudentName, 'BOOK_APPOINTMENT', code, `Đặt lịch tư vấn ngày ${date} (Dev Mode)`);

    return res.status(201).json({
      success: true,
      isDemoMode: true,
      isEphemeral: true,
      message: 'Đặt lịch tư vấn thành công trên giao diện thử nghiệm! [CHÚ Ý]: Dữ liệu KHÔNG lưu vào cơ sở dữ liệu thực tế.',
      appointment: newApt,
    });
  }

  // Mode: Real PostgreSQL
  try {
    const existing = await db
      .select()
      .from(counselingAppointments)
      .where(
        and(
          eq(counselingAppointments.counselorId, targetCounselorId),
          eq(counselingAppointments.date, date),
          sql`${counselingAppointments.status} != 'CANCELLED'`,
          or(
            and(sql`${counselingAppointments.startTime} <= ${startTime}`, sql`${counselingAppointments.endTime} > ${startTime}`),
            and(sql`${counselingAppointments.startTime} < ${endTime}`, sql`${counselingAppointments.endTime} >= ${endTime}`),
            and(sql`${counselingAppointments.startTime} >= ${startTime}`, sql`${counselingAppointments.endTime} <= ${endTime}`)
          )
        )
      );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Khung giờ ${startTime} - ${endTime} ngày ${date} của thầy/cô đã có người đặt trước. Vui lòng chọn khung giờ khác.`,
      });
    }

    const counselorQuery = await db.select().from(users).where(eq(users.uid, targetCounselorId)).limit(1);
    const counselorName = counselorQuery.length > 0 ? counselorQuery[0].fullName : 'ThS. Nguyễn Tuấn Anh';

    const inserted = await db
      .insert(counselingAppointments)
      .values({
        appointmentCode: code,
        counselorId: targetCounselorId,
        counselorName,
        studentName: cleanStudentName,
        studentContact: cleanContact,
        date,
        startTime,
        endTime,
        format: sanitizeText(format) || 'IN_PERSON',
        location:
          format === 'PRIVATE_ONLINE'
            ? 'Phòng họp trực tuyến bảo mật của trường'
            : 'Phòng Tư vấn Tâm lý Học đường (P.204)',
        status: 'SCHEDULED',
        reasonTopic: sanitizeText(reasonTopic),
        privateNotes: cleanNotes,
      })
      .returning();

    await addAuditLog(cleanStudentName, 'BOOK_APPOINTMENT', code, `Đặt lịch tư vấn ngày ${date}`);

    return res.status(201).json({
      success: true,
      message: 'Đặt lịch tư vấn thành công! Thầy cô sẽ liên hệ xác nhận sớm nhất.',
      appointment: inserted[0],
    });
  } catch (err) {
    console.error('[BOOK_APPT_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi lưu lịch hẹn.' });
  }
});

// ==========================================
// 4. BULLYING REPORTS (PHÒNG CHỐNG BẮT NẠT)
// ==========================================

apiRouter.post('/bullying', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const { gradeLevel, victimType, incidentType, location, incidentDate, description, safeContact, isAnonymous } = req.body;

  if (!incidentType || !description) {
    return res.status(400).json({ success: false, message: 'Vui lòng mô tả hình thức và sự việc xảy ra.' });
  }

  const cleanDescription = sanitizeText(description).trim();
  if (cleanDescription.length < 5) {
    return res.status(400).json({ success: false, message: 'Nội dung mô tả sự việc quá ngắn.' });
  }

  const code = generateSecureTicketCode('BCBN');

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const report = devStore.createBullyingReport({
      reportCode: code,
      gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
      victimType: sanitizeText(victimType) || 'Bản thân em bị',
      incidentType: sanitizeText(incidentType),
      location: location ? sanitizeText(location) : null,
      incidentDate: incidentDate ? sanitizeText(incidentDate) : null,
      description: cleanDescription,
      safeContact: safeContact ? sanitizeText(safeContact) : null,
      isAnonymous: isAnonymous !== false,
      status: 'URGENT_REVIEW',
      actionPlan: null,
    });

    devStore.addAuditLog('ANONYMOUS_REPORTER', 'SUBMIT_BULLYING_REPORT', code, 'Báo cáo bạo lực học đường (Dev Mode)');

    return res.status(201).json({
      success: true,
      isDemoMode: true,
      isEphemeral: true,
      message: 'Báo cáo của em đã được ghi nhận trên giao diện thử nghiệm. [CHÚ Ý]: Dữ liệu KHÔNG lưu vào cơ sở dữ liệu thực tế.',
      reportCode: code,
      report,
    });
  }

  // Mode: Real PostgreSQL
  try {
    const inserted = await db
      .insert(bullyingReports)
      .values({
        reportCode: code,
        gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
        victimType: sanitizeText(victimType) || 'Bản thân em bị',
        incidentType: sanitizeText(incidentType),
        location: location ? sanitizeText(location) : null,
        incidentDate: incidentDate ? sanitizeText(incidentDate) : null,
        description: cleanDescription,
        safeContact: safeContact ? sanitizeText(safeContact) : null,
        isAnonymous: isAnonymous !== false,
        status: 'URGENT_REVIEW',
      })
      .returning();

    await addAuditLog('ANONYMOUS_REPORTER', 'SUBMIT_BULLYING_REPORT', code, 'Báo cáo bạo lực học đường');

    return res.status(201).json({
      success: true,
      message: 'Báo cáo của em đã được gửi an toàn tới Ban An Toàn và Tư Vấn Học Đường của trường.',
      reportCode: code,
      report: inserted[0],
    });
  } catch (err) {
    console.error('[BULLYING_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi gửi báo cáo bắt nạt.' });
  }
});

apiRouter.get(
  '/bullying',
  requireAuth,
  requireRoles('COUNSELOR', 'TEACHER', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, reports: devStore.listBullyingReports(), isDemoMode: true });
    }

    try {
      const reports = await db.select().from(bullyingReports).orderBy(desc(bullyingReports.createdAt));
      return res.json({ success: true, reports });
    } catch (err) {
      console.error('[GET_BULLYING_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tải báo cáo bắt nạt.' });
    }
  }
);

// ==========================================
// 5. EMOTION CHECK-IN
// ==========================================

apiRouter.post('/emotions', rateLimit(30, 60000), async (req: Request, res: Response) => {
  const { moodKey, moodLabel, energyScore, note, gradeLevel } = req.body;
  if (!moodKey || !moodLabel) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn cảm xúc của bạn.' });
  }

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    const data = devStore.addEmotionCheckin({
      moodKey: sanitizeText(moodKey),
      moodLabel: sanitizeText(moodLabel),
      energyScore: Number.isInteger(energyScore) && energyScore >= 1 && energyScore <= 5 ? energyScore : 3,
      note: note ? sanitizeText(note).slice(0, 300) : null,
      gradeLevel: sanitizeText(gradeLevel) || 'GENERAL',
    });

    return res.status(201).json({
      success: true,
      isDemoMode: true,
      message: 'Cảm ơn em đã chia sẻ cảm xúc trên giao diện thử nghiệm.',
      data,
    });
  }

  // Mode: Real PostgreSQL
  try {
    const inserted = await db
      .insert(emotionCheckins)
      .values({
        moodKey: sanitizeText(moodKey),
        moodLabel: sanitizeText(moodLabel),
        energyScore: Number.isInteger(energyScore) && energyScore >= 1 && energyScore <= 5 ? energyScore : 3,
        note: note ? sanitizeText(note).slice(0, 300) : null,
        gradeLevel: sanitizeText(gradeLevel) || 'GENERAL',
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn em đã chia sẻ cảm xúc.',
      data: inserted[0],
    });
  } catch (err) {
    console.error('[EMOTION_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi lưu cảm xúc.' });
  }
});

apiRouter.get('/emotions/stats', async (req: Request, res: Response) => {
  if (!isDatabaseConnected()) {
    return res.json({ success: true, stats: devStore.getEmotionStats(), isDemoMode: true });
  }

  try {
    const all = await db.select().from(emotionCheckins);
    const stats: Record<string, number> = {};
    for (const c of all) {
      stats[c.moodKey] = (stats[c.moodKey] || 0) + 1;
    }
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[EMOTION_STATS_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê cảm xúc.' });
  }
});

// ==========================================
// 6. EDUCATIONAL RESOURCES
// ==========================================

apiRouter.get('/resources', async (req: Request, res: Response) => {
  const { gradeLevel, category, search } = req.query;

  // Mode: In-Memory Dev Mode
  if (!isDatabaseConnected()) {
    let items = devStore.listResources(
      typeof category === 'string' ? category : undefined,
      typeof gradeLevel === 'string' ? gradeLevel : undefined
    );
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      items = items.filter((r) => r.title.toLowerCase().includes(s) || r.summary.toLowerCase().includes(s));
    }
    return res.json({ success: true, resources: items, isDemoMode: true });
  }

  // Mode: Real PostgreSQL
  try {
    let query = db.select().from(educationalResources).where(eq(educationalResources.isPublished, true));
    const items = await query.orderBy(desc(educationalResources.createdAt));

    let filtered = items;
    if (gradeLevel && gradeLevel !== 'ALL') {
      filtered = filtered.filter((r: any) => r.gradeLevel === gradeLevel || r.gradeLevel === 'GENERAL');
    }
    if (category && category !== 'ALL') {
      filtered = filtered.filter((r: any) => r.category === category);
    }
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      filtered = filtered.filter((r: any) => r.title.toLowerCase().includes(s) || r.summary.toLowerCase().includes(s));
    }

    return res.json({ success: true, resources: filtered });
  } catch (err) {
    console.error('[RESOURCES_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải học liệu.' });
  }
});

apiRouter.get('/resources/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug;

  if (!isDatabaseConnected()) {
    const resItem = devStore.getResourceBySlug(slug);
    if (!resItem) return res.status(404).json({ success: false, message: 'Bài viết không tồn tại.' });
    return res.json({ success: true, resource: resItem, isDemoMode: true });
  }

  try {
    const found = await db.select().from(educationalResources).where(eq(educationalResources.slug, slug)).limit(1);
    if (found.length === 0) return res.status(404).json({ success: false, message: 'Bài viết không tồn tại.' });
    return res.json({ success: true, resource: found[0] });
  } catch (err) {
    console.error('[GET_RESOURCE_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải bài viết.' });
  }
});

apiRouter.post(
  '/resources',
  requireAuth,
  requireRoles('COUNSELOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { title, summary, content, category, gradeLevel, readTimeMinutes } = req.body;
    if (!title || !content || !category) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ tiêu đề, nội dung và danh mục.' });
    }

    const cleanTitle = sanitizeText(title).trim();
    const cleanSummary = sanitizeText(summary).trim();
    const cleanContent = sanitizeText(content).trim();
    const slug = `${cleanTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')}-${Math.floor(Math.random() * 1000)}`;

    if (!isDatabaseConnected()) {
      const newRes = devStore.createResource({
        title: cleanTitle,
        slug,
        summary: cleanSummary,
        content: cleanContent,
        category: sanitizeText(category),
        gradeLevel: (sanitizeText(gradeLevel) as any) || 'GENERAL',
        readTimeMinutes: Number(readTimeMinutes) || 3,
        isPublished: true,
      });

      devStore.addAuditLog(req.user!.uid, 'CREATE_RESOURCE', newRes.title, 'Tạo bài viết học liệu mới (Dev Mode)');
      return res.status(201).json({ success: true, resource: newRes, isDemoMode: true });
    }

    try {
      const inserted = await db
        .insert(educationalResources)
        .values({
          title: cleanTitle,
          slug,
          summary: cleanSummary,
          content: cleanContent,
          category: sanitizeText(category),
          gradeLevel: sanitizeText(gradeLevel) || 'GENERAL',
          readTimeMinutes: Number(readTimeMinutes) || 3,
          isPublished: true,
          authorName: req.user!.fullName,
        })
        .returning();

      await addAuditLog(req.user!.uid, 'CREATE_RESOURCE', inserted[0].title, 'Tạo bài viết học liệu mới');

      return res.status(201).json({ success: true, resource: inserted[0] });
    } catch (err) {
      console.error('[CREATE_RES_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tạo bài viết.' });
    }
  }
);

// ==========================================
// 7. GEMINI AI COMPANION ("BẠN ĐỒNG HÀNH")
// ==========================================

apiRouter.post('/ai/chat', rateLimit(25, 60000), async (req: Request, res: Response) => {
  try {
    const { message, gradeLevel, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    const cleanMessage = sanitizeText(message).slice(0, 500);
    const aiResult = await askCompanionAI(cleanMessage, gradeLevel || 'SECONDARY', history || []);

    return res.json({ success: true, data: aiResult });
  } catch (err) {
    console.error('[AI_CHAT_ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Hệ thống trợ lý AI đang bận. Bạn hãy thử lại sau ít phút hoặc gửi tâm sự qua Góc Chia Sẻ nhé.',
    });
  }
});

// Endpoint to escalate and transfer from AI conversation directly to Human Counselor
apiRouter.post('/ai/escalate', rateLimit(15, 60000), async (req: Request, res: Response) => {
  try {
    const { messageSummary, gradeLevel, studentAlias, contactMethod } = req.body;
    const requestCode = generateSecureTicketCode('GLN');

    const cleanSummary = sanitizeText(messageSummary).slice(0, 1000);
    const cleanAlias = sanitizeText(studentAlias) || 'Học sinh từ phiên trợ lý AI';
    const cleanMethod = sanitizeText(contactMethod) || 'Gặp trực tiếp tại Phòng 204';

    if (!isDatabaseConnected()) {
      const devReq = devStore.createRequest({
        requestCode,
        gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
        topic: 'EMOTIONAL_STRESS',
        isAnonymous: true,
        studentAlias: cleanAlias,
        contactMethod: cleanMethod,
        content: `[Chuyển tiếp từ phiên trò chuyện cùng Bạn Đồng Hành AI]:\n${cleanSummary || 'Học sinh cần gặp trực tiếp thầy cô để được lắng nghe và hỗ trợ tâm lý.'}`,
        status: 'RECEIVED',
        urgencyLevel: 'URGENT',
        privacyAgreed: true,
        preferredTime: 'Giờ ra chơi hoặc sau giờ học',
      });

      devStore.addAuditLog(cleanAlias, 'AI_ESCALATE_TO_COUNSELOR', requestCode, 'Chuyển tiếp hỗ trợ sang chuyên viên (Dev Mode)');

      return res.status(201).json({
        success: true,
        isDemoMode: true,
        isEphemeral: true,
        message: 'Đã tạo phiếu kết nối bảo mật thành công trên giao diện thử nghiệm. [CHÚ Ý]: Dữ liệu KHÔNG lưu vào cơ sở dữ liệu thực tế.',
        requestCode: devReq.requestCode,
        assignedStaff: gradeLevel === 'PRIMARY' ? 'Cô Nguyễn Thị Thùy Trang' : 'ThS. Nguyễn Tuấn Anh',
        location: 'Phòng Tư vấn Tâm lý Học đường (Phòng 204)',
      });
    }

    const assignedCounselorId = gradeLevel === 'PRIMARY' ? 'usr-counselor-02' : 'usr-counselor-01';

    const inserted = await db
      .insert(counselingRequests)
      .values({
        requestCode,
        gradeLevel: sanitizeText(gradeLevel) || 'SECONDARY',
        topic: 'EMOTIONAL_STRESS',
        isAnonymous: true,
        studentAlias: cleanAlias,
        contactMethod: cleanMethod,
        content: `[Chuyển tiếp từ phiên trò chuyện cùng Bạn Đồng Hành AI]:\n${cleanSummary || 'Học sinh cần gặp trực tiếp thầy cô để được lắng nghe và hỗ trợ tâm lý.'}`,
        status: 'RECEIVED',
        urgencyLevel: 'URGENT',
        privacyAgreed: true,
        assignedCounselorId,
      })
      .returning();

    await addAuditLog(
      cleanAlias,
      'AI_ESCALATE_TO_COUNSELOR',
      requestCode,
      'Chuyển tiếp hỗ trợ trực tiếp từ trợ lý AI sang chuyên viên tư vấn'
    );

    return res.status(201).json({
      success: true,
      message: 'Đã tạo phiếu kết nối bảo mật thành công tới chuyên viên tư vấn học đường.',
      requestCode: inserted[0].requestCode,
      assignedStaff: gradeLevel === 'PRIMARY' ? 'Cô Nguyễn Thị Thùy Trang' : 'ThS. Nguyễn Tuấn Anh',
      location: 'Phòng Tư vấn Tâm lý Học đường (Phòng 204)',
    });
  } catch (err) {
    console.error('[ESCALATE_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi chuyển tiếp hồ sơ sang chuyên viên.' });
  }
});

// ==========================================
// 8. STATS & AUDIT LOGS
// ==========================================

apiRouter.get(
  '/stats',
  requireAuth,
  requireRoles('COUNSELOR', 'TEACHER', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isDatabaseConnected()) {
      const allRequests = devStore.listRequests();
      const allAppointments = devStore.listAppointments();
      const allBullying = devStore.listBullyingReports();

      const totalRequests = allRequests.length;
      const inProgressRequests = allRequests.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'WAITING_FEEDBACK').length;
      const resolvedRequests = allRequests.filter((r) => r.status === 'RESOLVED' || r.status === 'CLOSED').length;
      const totalAppointments = allAppointments.length;
      const bullyingCount = allBullying.length;

      const topicCounts: Record<string, number> = {};
      for (const r of allRequests) {
        topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
      }

      const gradeCounts: Record<string, number> = {};
      for (const r of allRequests) {
        gradeCounts[r.gradeLevel] = (gradeCounts[r.gradeLevel] || 0) + 1;
      }

      return res.json({
        success: true,
        isDemoMode: true,
        stats: {
          totalRequests,
          inProgressRequests,
          resolvedRequests,
          totalAppointments,
          bullyingCount,
          topicCounts,
          gradeCounts,
        },
      });
    }

    try {
      const allRequests = await db.select().from(counselingRequests);
      const allAppointments = await db.select().from(counselingAppointments);
      const allBullying = await db.select().from(bullyingReports);

      const totalRequests = allRequests.length;
      const inProgressRequests = allRequests.filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'CLASSIFYING').length;
      const resolvedRequests = allRequests.filter((r: any) => r.status === 'RESOLVED' || r.status === 'CLOSED').length;
      const totalAppointments = allAppointments.length;
      const bullyingCount = allBullying.length;

      const topicCounts: Record<string, number> = {};
      for (const r of allRequests) {
        topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
      }

      const gradeCounts: Record<string, number> = {};
      for (const r of allRequests) {
        gradeCounts[r.gradeLevel] = (gradeCounts[r.gradeLevel] || 0) + 1;
      }

      return res.json({
        success: true,
        stats: {
          totalRequests,
          inProgressRequests,
          resolvedRequests,
          totalAppointments,
          bullyingCount,
          topicCounts,
          gradeCounts,
        },
      });
    } catch (err) {
      console.error('[STATS_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi tổng hợp số liệu.' });
    }
  }
);

apiRouter.get('/audit-logs', requireAuth, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!isDatabaseConnected()) {
    return res.json({ success: true, logs: devStore.getAuditLogs(), isDemoMode: true });
  }

  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('[AUDIT_GET_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải nhật ký kiểm toán.' });
  }
});

// ==========================================
// 8. TÂM SỰ HỌC SINH (GÓC CHIA SẺ & TRẢI LÒNG)
// ==========================================

// 8.1. Học sinh gửi tâm sự (KHÔNG cần đăng nhập, tạo mã bí mật ngẫu nhiên cao)
apiRouter.post('/posts/submit', rateLimit(15, 60000), async (req: Request, res: Response) => {
  const { title, content, isAnonymous, studentName, recipient } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề tâm sự.' });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung tâm sự.' });
  }

  const cleanTitle = sanitizeText(title).trim();
  const cleanContent = sanitizeText(content).trim();
  if (cleanContent.length < 5 || cleanContent.length > 5000) {
    return res.status(400).json({ success: false, message: 'Nội dung tâm sự từ 5 đến 5000 ký tự.' });
  }

  // Tạo mã tra cứu ngẫu nhiên bí mật độ entropy cao: TS-XXXX-XXXX
  const secretCode = generateSecureTicketCode('TS');
  const secretHash = hashSecretCode(secretCode);

  const cleanAuthor = isAnonymous ? 'Học sinh ẩn danh' : (sanitizeText(studentName).trim() || 'Học sinh');
  const cleanRecipient = sanitizeText(recipient).trim() || 'Cô Nguyễn Thị Thùy Trang (Phòng 692)';

  const newPost = devStore.createPost({
    title: cleanTitle,
    content: cleanContent,
    author: cleanAuthor,
    recipient: cleanRecipient,
    secretHash,
    status: 'WAITING',
  });

  return res.status(201).json({
    success: true,
    message: 'Tâm sự của em đã được gửi an toàn đến Cô Trang!',
    secretCode, // Trả về MỘT LẦN DUY NHẤT cho học sinh lưu
    post: {
      id: newPost.id,
      title: newPost.title,
      status: newPost.status,
      createdAt: newPost.createdAt
    }
  });
});

// 8.2. Học sinh tra cứu tâm sự và câu trả lời của giáo viên bằng mã bí mật
apiRouter.post('/posts/track', rateLimit(25, 60000), async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isLookupBlocked(ip)) {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử tra cứu sai quá nhiều lần. Vì an toàn bảo mật, tạm thời bị khóa trong 10 phút.',
    });
  }

  const { secretCode } = req.body;
  if (!secretCode || typeof secretCode !== 'string' || secretCode.trim().length < 6) {
    trackFailedLookup(ip);
    return res.status(400).json({ success: false, message: 'Mã tra cứu không hợp lệ.' });
  }

  const cleanCode = secretCode.trim().toUpperCase();
  const hashed = hashSecretCode(cleanCode);

  const post = devStore.findPostByHash(hashed);
  if (!post) {
    const isBlocked = trackFailedLookup(ip);
    return res.status(404).json({
      success: false,
      message: isBlocked
        ? 'Mã không đúng. Bạn đã bị tạm khóa 10 phút do thử nhiều lần.'
        : 'Mã tra cứu không chính xác hoặc bài tâm sự không tồn tại. Vui lòng kiểm tra lại.',
    });
  }

  resetLookupFailure(ip);

  // Chỉ trả về dữ liệu an toàn, KHÔNG trả về secretHash
  return res.json({
    success: true,
    data: {
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author,
      recipient: post.recipient,
      status: post.status,
      createdAt: post.createdAt,
      createdStr: post.createdStr,
      responses: post.responses || []
    }
  });
});

// 8.3. Học sinh gửi tin nhắn tiếp theo trong cuộc trò chuyện bằng mã bí mật
apiRouter.post('/posts/reply-student', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const { secretCode, message, senderName, title, postContent } = req.body;

  if (!secretCode || typeof secretCode !== 'string') {
    return res.status(400).json({ success: false, message: 'Mã tra cứu không hợp lệ.' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
  }

  const cleanCode = secretCode.trim().toUpperCase();
  const hashed = hashSecretCode(cleanCode);

  let post = devStore.findPostByHash(hashed);
  const cleanSender = sanitizeText(senderName || '').trim() || 'Học sinh';
  const cleanMessage = sanitizeText(message).trim();

  if (!post) {
    // Tự động khôi phục post vào memory nếu post được tạo từ client/Firestore
    post = devStore.createPost({
      title: title ? sanitizeText(title).trim() : 'Tâm sự của học sinh',
      content: postContent ? sanitizeText(postContent).trim() : 'Nội dung trao đổi',
      author: cleanSender,
      recipient: 'Cô Nguyễn Thị Thùy Trang (Phòng 692)',
      secretHash: hashed,
      status: 'WAITING'
    });
  }

  const newResp = devStore.addPostResponse(post.id, 'STUDENT', cleanSender, cleanMessage);

  return res.json({
    success: true,
    message: 'Đã gửi tin nhắn đến giáo viên thành công!',
    response: newResp,
    status: post.status
  });
});

// 8.4. Giáo viên / Quản trị viên xem danh sách tất cả các bài tâm sự (YÊU CẦU ĐĂNG NHẬP)
apiRouter.get('/posts/admin-list', requireAuth, requireRoles('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const list = devStore.getPosts();
  // Giấu secretHash khỏi danh sách trả về để bảo vệ học sinh
  const sanitizedList = list.map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    author: p.author,
    recipient: p.recipient,
    status: p.status || 'WAITING',
    createdAt: p.createdAt,
    createdStr: p.createdStr,
    responses: p.responses || []
  }));

  return res.json({
    success: true,
    posts: sanitizedList
  });
});

// 8.5. Giáo viên / Quản trị viên gửi phản hồi cho bài tâm sự
apiRouter.post('/posts/admin-reply', requireAuth, requireRoles('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { postId, content, status, title, postContent, author } = req.body;

  if (!postId || !content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã bài viết và nội dung phản hồi.' });
  }

  let post = devStore.findPostById(postId);
  if (!post) {
    // Tự động khôi phục post vào devStore nếu post được tạo trên Firestore/localStorage
    const postTitle = title ? sanitizeText(title).trim() : 'Bài tâm sự học sinh';
    post = devStore.createPost({
      title: postTitle,
      content: postContent ? sanitizeText(postContent).trim() : 'Nội dung tâm sự',
      author: author ? sanitizeText(author).trim() : 'Học sinh',
      recipient: 'Cô Nguyễn Thị Thùy Trang (Phòng 692)',
      status: 'REPLIED'
    });
    post.id = postId;
  }

  const cleanContent = sanitizeText(content).trim();
  const teacherName = req.user?.fullName || 'Cô Nguyễn Thị Thùy Trang (Phòng 692)';

  const newResp = devStore.addPostResponse(post.id, 'TEACHER', teacherName, cleanContent);
  if (status) {
    devStore.updatePostStatus(post.id, sanitizeText(status));
  }

  devStore.addAuditLog(req.user?.uid || 'COUNSELOR', 'REPLY_POST', post.id, `Giáo viên phản hồi bài: ${post.title}`);

  return res.json({
    success: true,
    message: 'Đã gửi phản hồi cho học sinh thành công!',
    response: newResp,
    postStatus: post.status
  });
});

// 8.6. Giáo viên / Quản trị viên cập nhật trạng thái bài tâm sự
apiRouter.patch('/posts/admin-status/:id', requireAuth, requireRoles('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Thiếu trạng thái cập nhật.' });
  }

  const updated = devStore.updatePostStatus(id, sanitizeText(status));
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bài tâm sự.' });
  }

  return res.json({ success: true, message: 'Đã cập nhật trạng thái thành công.' });
});

// 8.7. Giáo viên / Quản trị viên xóa bài tâm sự
apiRouter.delete('/posts/admin-delete/:id', requireAuth, requireRoles('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = devStore.deletePost(id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bài tâm sự.' });
  }
  return res.json({ success: true, message: 'Đã xóa bài tâm sự.' });
});
