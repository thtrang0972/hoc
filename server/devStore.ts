// In-Memory Development Store for "Góc Lắng Nghe - Cùng Em Trưởng Thành"
// Dùng cho chế độ xem trước và kiểm thử giao diện khi chưa cấu hình cơ sở dữ liệu PostgreSQL.
// CẢNH BÁO: Dữ liệu ở đây chỉ lưu tạm trong RAM và KHÔNG lưu vào hệ thống thực tế!

export interface DevUser {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'COUNSELOR' | 'ADMIN';
  gradeLevel: 'PRIMARY' | 'SECONDARY' | 'GENERAL';
  phoneNumber?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface DevRequest {
  id: string;
  requestCode: string;
  gradeLevel: string;
  topic: string;
  isAnonymous: boolean;
  studentAlias: string;
  studentClass?: string | null;
  contactMethod: string;
  contactValue?: string | null;
  preferredTime: string;
  content: string;
  status: string;
  urgencyLevel: string;
  privacyAgreed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevMessage {
  id: string;
  requestId?: string;
  requestCode: string;
  senderType: 'STUDENT' | 'COUNSELOR';
  senderName: string;
  message: string;
  createdAt: string;
}

export interface DevAppointment {
  id: string;
  appointmentCode: string;
  studentName: string;
  studentId?: string | null;
  counselorId: string;
  counselorName: string;
  date: string;
  startTime: string;
  endTime: string;
  format: 'IN_PERSON' | 'PRIVATE_ONLINE' | 'PHONE_SAFE';
  location: string;
  reasonTopic: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface DevResource {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  gradeLevel: 'PRIMARY' | 'SECONDARY' | 'GENERAL';
  thumbnailUrl?: string;
  readTimeMinutes: number;
  isPublished: boolean;
  createdAt: string;
}

export interface DevBullyingReport {
  id: string;
  reportCode: string;
  gradeLevel: string;
  victimType: string;
  incidentType: string;
  location?: string | null;
  incidentDate?: string | null;
  description: string;
  safeContact?: string | null;
  isAnonymous: boolean;
  status: string;
  actionPlan?: string | null;
  createdAt: string;
}

export interface DevEmotionCheckin {
  id: string;
  sessionId?: string | null;
  moodKey: string;
  moodLabel: string;
  energyScore?: number | null;
  note?: string | null;
  gradeLevel: string;
  createdAt: string;
}

export interface DevAuditLog {
  id: string;
  username: string;
  actionType: string;
  targetResource: string;
  details?: string | null;
  createdAt: string;
}

class DevDataStore {
  private users: DevUser[] = [
    {
      id: 'u-1',
      uid: 'usr-student-01',
      email: 'minhan.nguyen@hocsinh.edu.vn',
      fullName: 'Em Nguyễn Minh An',
      role: 'STUDENT',
      gradeLevel: 'SECONDARY',
      phoneNumber: '0912345678',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isActive: true,
    },
    {
      id: 'u-2',
      uid: 'usr-counselor-1',
      email: 'tuananh.nguyen@truonghoc.edu.vn',
      fullName: 'ThS. Tâm lý Nguyễn Tuấn Anh',
      role: 'COUNSELOR',
      gradeLevel: 'GENERAL',
      phoneNumber: '0912 345 678',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      isActive: true,
    },
    {
      id: 'u-2b',
      uid: 'usr-counselor-2',
      email: 'thuytrang.nguyen@truonghoc.edu.vn',
      fullName: 'Cô Nguyễn Thị Thùy Trang (Tư vấn Tiểu học)',
      role: 'COUNSELOR',
      gradeLevel: 'PRIMARY',
      phoneNumber: '0912 888 999',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      isActive: true,
    },
    {
      id: 'u-3',
      uid: 'usr-teacher-01',
      email: 'quoctuan.tran@truonghoc.edu.vn',
      fullName: 'Thầy Trần Quốc Tuấn (GVCN 8A2)',
      role: 'TEACHER',
      gradeLevel: 'SECONDARY',
      phoneNumber: '0903112233',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      isActive: true,
    },
    {
      id: 'u-4',
      uid: 'usr-parent-01',
      email: 'vanbinh.nguyen@phuhuynh.edu.vn',
      fullName: 'Bác Nguyễn Văn Bình (Phụ huynh)',
      role: 'PARENT',
      gradeLevel: 'SECONDARY',
      phoneNumber: '0944556677',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      isActive: true,
    },
    {
      id: 'u-5',
      uid: 'usr-admin-01',
      email: 'haidang.le@truonghoc.edu.vn',
      fullName: 'Thầy Lê Hải Đăng (Ban Giám Hiệu)',
      role: 'ADMIN',
      gradeLevel: 'GENERAL',
      phoneNumber: '0988990011',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      isActive: true,
    },
  ];

  private requests: DevRequest[] = [
    {
      id: 'req-1',
      requestCode: 'GLN-849201',
      gradeLevel: 'SECONDARY',
      topic: 'STUDY_PRESSURE',
      isAnonymous: true,
      studentAlias: 'Bạn lớp 8 giấu tên',
      studentClass: '8A2',
      contactMethod: 'Hòm thư bí mật',
      contactValue: 'minhan.nguyen@hocsinh.edu.vn',
      preferredTime: 'Sau giờ học thứ 3',
      content: 'Em cảm thấy rất căng thẳng trước kỳ thi học kỳ sắp tới. Bố mẹ kỳ vọng điểm cao khiến em hay bị mất ngủ và lo lắng.',
      status: 'IN_PROGRESS',
      urgencyLevel: 'NORMAL',
      privacyAgreed: true,
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'req-2',
      requestCode: 'GLN-193842',
      gradeLevel: 'PRIMARY',
      topic: 'PEER_FRIENDSHIP',
      isAnonymous: false,
      studentAlias: 'Bé Linh Nhi',
      studentClass: '4B',
      contactMethod: 'Gặp trực tiếp tại Phòng 204',
      contactValue: null,
      preferredTime: 'Giờ ra chơi buổi sáng',
      content: 'Các bạn trong lớp hay chia nhóm chơi riêng và không cho em chơi cùng. Em cảm thấy rất buồn mỗi giờ ra chơi.',
      status: 'RECEIVED',
      urgencyLevel: 'NORMAL',
      privacyAgreed: true,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'req-3',
      requestCode: 'GLN-572910',
      gradeLevel: 'SECONDARY',
      topic: 'EMOTIONAL_STRESS',
      isAnonymous: true,
      studentAlias: 'Em học sinh THCS',
      studentClass: '7C',
      contactMethod: 'Kênh trực tuyến an toàn',
      contactValue: 'hopthu.hocsinh@gmail.com',
      preferredTime: 'Cuối tuần thứ 7',
      content: 'Dạo này em hay cảm thấy chán nản, không muốn nói chuyện với ai và rất khó tập trung học bài.',
      status: 'WAITING_FEEDBACK',
      urgencyLevel: 'NORMAL',
      privacyAgreed: true,
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  private messages: DevMessage[] = [
    {
      id: 'msg-1',
      requestCode: 'GLN-849201',
      senderType: 'COUNSELOR',
      senderName: 'Thầy Nguyễn Tuấn Anh',
      message: 'Chào em, thầy Tuấn Anh đây. Thầy đã đọc chia sẻ của em. Kỳ thi nào cũng có áp lực, nhưng sức khỏe và tinh thần của em mới là điều quan trọng nhất. Chiều thứ Ba này lúc 16h15 em ghé phòng 204 trò chuyện cùng thầy nhé!',
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    },
    {
      id: 'msg-2',
      requestCode: 'GLN-849201',
      senderType: 'STUDENT',
      senderName: 'Em học sinh',
      message: 'Dạ vâng ạ, em cảm ơn cô nhiều. Chiều thứ Ba tan học em sẽ qua phòng cô ạ.',
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    },
  ];

  private notes: Array<{
    id: string;
    requestId: string;
    authorId: string;
    actionTaken: string | null;
    noteContent: string;
    isPrivate: boolean;
    createdAt: string;
  }> = [
    {
      id: 'note-1',
      requestId: 'req-1',
      authorId: 'u-2',
      actionTaken: 'Đã hẹn gặp trực tiếp tại phòng tư vấn chiều thứ 3',
      noteContent: 'Học sinh có dấu hiệu lo âu học đường mức độ vừa, cần hướng dẫn phương pháp quản lý thời gian và bài tập thở 4-7-8.',
      isPrivate: true,
      createdAt: new Date(Date.now() - 3600000 * 19).toISOString(),
    },
  ];

  private appointments: DevAppointment[] = [
    {
      id: 'apt-1',
      appointmentCode: 'APT-88219',
      studentName: 'Nguyễn Minh An',
      studentId: 'u-1',
      counselorId: 'usr-counselor-1',
      counselorName: 'ThS. Nguyễn Tuấn Anh',
      date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      startTime: '14:30',
      endTime: '15:15',
      format: 'IN_PERSON',
      location: 'Phòng Tư vấn Tâm lý Học đường (P.204)',
      reasonTopic: 'STUDY_PRESSURE',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    },
    {
      id: 'apt-2',
      appointmentCode: 'APT-77402',
      studentName: 'Em học sinh lớp 7',
      studentId: null,
      counselorId: 'usr-counselor-2',
      counselorName: 'Cô Nguyễn Thị Thùy Trang',
      date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      startTime: '09:30',
      endTime: '10:15',
      format: 'PRIVATE_ONLINE',
      location: 'Kênh họp bảo mật của trường',
      reasonTopic: 'EMOTIONAL_STRESS',
      status: 'SCHEDULED',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ];

  private resources: DevResource[] = [
    {
      id: 'res-1',
      title: '5 Bước Hít Thở Sâu Giúp Giảm Lo Âu Trước Giờ Kiểm Tra',
      slug: '5-buoc-hit-tho-sau-giam-lo-au',
      summary: 'Kỹ thuật thở 4-7-8 đơn giản nhưng hiệu quả, giúp các em lấy lại bình tĩnh và sự tập trung chỉ trong 3 phút.',
      content: 'Khi cảm thấy tim đập nhanh và lo lắng trước giờ thi, hãy ngồi thẳng lưng, hít vào bằng mũi trong 4 giây, giữ hơi thở 7 giây, và thở từ từ ra bằng miệng trong 8 giây...',
      category: 'Kỹ năng cảm xúc',
      gradeLevel: 'SECONDARY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600',
      readTimeMinutes: 3,
      isPublished: true,
      createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    },
    {
      id: 'res-2',
      title: 'Làm Gì Khi Thấy Bạn Bị Trêu Chọc Ở Trường?',
      slug: 'lam-gi-khi-thay-ban-bi-treu-choc',
      summary: 'Hành động nhỏ của người chứng kiến có thể thay đổi cả một ngày tồi tệ của bạn mình.',
      content: 'Đừng im lặng trước hành vi trêu chọc hay bắt nạt. Em có thể đến bên bạn, rủ bạn đi cùng hoặc báo ngay cho thầy cô chủ nhiệm...',
      category: 'Phòng chống bạo lực',
      gradeLevel: 'GENERAL',
      thumbnailUrl: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600',
      readTimeMinutes: 4,
      isPublished: true,
      createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    },
    {
      id: 'res-3',
      title: 'Cách Nói Chuyện Với Bố Mẹ Khi Con Cảm Thấy Áp Lực',
      slug: 'cach-noi-chuyen-voi-bo-me-khi-ap-luc',
      summary: 'Gợi ý cách mở lời chân thành để bố mẹ thấu hiểu tâm tư và đồng hành cùng con.',
      content: 'Chọn một thời điểm bố mẹ đang thư thả, như sau bữa cơm tối hoặc cuối tuần. Em hãy bắt đầu bằng: "Bố mẹ ơi, dạo này con cảm thấy..."',
      category: 'Tình bạn & Gia đình',
      gradeLevel: 'GENERAL',
      thumbnailUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600',
      readTimeMinutes: 5,
      isPublished: true,
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    },
  ];

  private bullyingReports: DevBullyingReport[] = [
    {
      id: 'bl-1',
      reportCode: 'BC-99120',
      gradeLevel: 'SECONDARY',
      victimType: 'Em chứng kiến bạn khác',
      incidentType: 'Cô lập tẩy chay',
      location: 'Sân bóng rổ sau trường',
      incidentDate: '2026-10-07',
      description: 'Em thấy có một nhóm bạn hay chặn đường và không cho một bạn lớp 7 vào chơi cùng, còn lấy đồ dùng của bạn giấu đi.',
      safeContact: 'homthu.anonym@truong.edu.vn',
      isAnonymous: true,
      status: 'URGENT_REVIEW',
      actionPlan: null,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ];

  private emotionCheckins: DevEmotionCheckin[] = [
    { id: 'em-1', moodKey: 'CALM', moodLabel: 'Bình yên', energyScore: 4, note: 'Hôm nay học bài thoải mái', gradeLevel: 'SECONDARY', createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 'em-2', moodKey: 'HAPPY', moodLabel: 'Vui vẻ', energyScore: 5, note: 'Được điểm 10 môn Toán', gradeLevel: 'PRIMARY', createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
    { id: 'em-3', moodKey: 'WORRIED', moodLabel: 'Lo âu', energyScore: 2, note: 'Sắp kiểm tra 1 tiết', gradeLevel: 'SECONDARY', createdAt: new Date(Date.now() - 3600000 * 6).toISOString() },
    { id: 'em-4', moodKey: 'TIRED', moodLabel: 'Mệt mỏi', energyScore: 2, note: 'Hôm qua ngủ muộn', gradeLevel: 'SECONDARY', createdAt: new Date(Date.now() - 3600000 * 8).toISOString() },
    { id: 'em-5', moodKey: 'CALM', moodLabel: 'Bình yên', energyScore: 4, note: null, gradeLevel: 'PRIMARY', createdAt: new Date(Date.now() - 3600000 * 10).toISOString() },
  ];

  private auditLogs: DevAuditLog[] = [
    {
      id: 'log-1',
      username: 'SYSTEM',
      actionType: 'DEV_BOOT',
      targetResource: 'SYSTEM_MEMORY',
      details: 'Khởi chạy chế độ phát triển xem trước giao diện (In-Memory Mode)',
      createdAt: new Date().toISOString(),
    },
  ];

  // User operations
  getUsers(): DevUser[] {
    return this.users.filter((u) => u.isActive);
  }

  findUser(identifier: string): DevUser | undefined {
    const clean = identifier.trim().toLowerCase();
    // 1. Exact UID or email match first
    const exact = this.users.find(
      (u) => u.uid.toLowerCase() === clean || u.email.toLowerCase() === clean
    );
    if (exact) return exact;

    // 2. Specific known aliases
    if (clean.includes('thuytrang') || clean === 'usr-counselor-2') {
      return this.users.find((u) => u.uid === 'usr-counselor-2');
    }
    if (clean.includes('tuananh') || clean === 'usr-counselor-1') {
      return this.users.find((u) => u.uid === 'usr-counselor-1');
    }

    // 3. Role / prefix keywords
    return this.users.find(
      (u) =>
        clean.includes(u.role.toLowerCase()) ||
        (clean.includes('hocsinh') && u.role === 'STUDENT') ||
        (clean.includes('tuvan') && u.role === 'COUNSELOR') ||
        (clean.includes('gvcn') && u.role === 'TEACHER') ||
        (clean.includes('phuhuynh') && u.role === 'PARENT') ||
        (clean.includes('quantri') && u.role === 'ADMIN')
    );
  }

  // Request operations
  createRequest(data: Omit<DevRequest, 'id' | 'createdAt' | 'updatedAt'>): DevRequest {
    const newReq: DevRequest = {
      ...data,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.requests.unshift(newReq);
    return newReq;
  }

  findRequestByCode(code: string): DevRequest | undefined {
    return this.requests.find((r) => r.requestCode.toUpperCase() === code.trim().toUpperCase());
  }

  findRequestById(id: string): DevRequest | undefined {
    return this.requests.find((r) => r.id === id || r.requestCode === id);
  }

  listRequests(filters?: { gradeLevel?: string; status?: string; topic?: string }): DevRequest[] {
    return this.requests.filter((r) => {
      if (filters?.gradeLevel && filters.gradeLevel !== 'ALL' && r.gradeLevel !== filters.gradeLevel) return false;
      if (filters?.status && filters.status !== 'ALL' && r.status !== filters.status) return false;
      if (filters?.topic && filters.topic !== 'ALL' && r.topic !== filters.topic) return false;
      return true;
    });
  }

  updateRequestStatus(idOrCode: string, status: string): DevRequest | undefined {
    const req = this.findRequestById(idOrCode) || this.findRequestByCode(idOrCode);
    if (req) {
      req.status = status;
      req.updatedAt = new Date().toISOString();
    }
    return req;
  }

  addRequestNote(requestId: string, authorId: string, noteContent: string, actionTaken?: string) {
    const newNote = {
      id: `note-${Date.now()}`,
      requestId,
      authorId,
      actionTaken: actionTaken || null,
      noteContent,
      isPrivate: true,
      createdAt: new Date().toISOString(),
    };
    this.notes.unshift(newNote);
    return newNote;
  }

  getRequestNotes(requestId: string) {
    return this.notes
      .filter((n) => n.requestId === requestId)
      .map((n) => {
        const author = this.users.find((u) => u.id === n.authorId);
        return {
          ...n,
          authorName: author ? author.fullName : 'Chuyên viên tư vấn',
        };
      });
  }

  // Conversation messages
  getMessages(codeOrId: string): DevMessage[] {
    return this.messages.filter((m) => m.requestCode === codeOrId || m.requestId === codeOrId);
  }

  addMessage(requestCode: string, senderType: 'STUDENT' | 'COUNSELOR', senderName: string, message: string): DevMessage {
    const newMsg: DevMessage = {
      id: `msg-${Date.now()}`,
      requestCode,
      senderType,
      senderName,
      message,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(newMsg);
    return newMsg;
  }

  // Appointment operations
  listAppointments(): DevAppointment[] {
    return this.appointments;
  }

  createAppointment(data: Omit<DevAppointment, 'id' | 'createdAt'>): DevAppointment {
    const newApt: DevAppointment = {
      ...data,
      id: `apt-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.appointments.unshift(newApt);
    return newApt;
  }

  updateAppointmentStatus(id: string, status: any): DevAppointment | undefined {
    const apt = this.appointments.find((a) => a.id === id || a.appointmentCode === id);
    if (apt) {
      apt.status = status;
    }
    return apt;
  }

  // Resources
  listResources(category?: string, gradeLevel?: string): DevResource[] {
    return this.resources.filter((r) => {
      if (category && category !== 'ALL' && r.category !== category) return false;
      if (gradeLevel && gradeLevel !== 'ALL' && r.gradeLevel !== gradeLevel && r.gradeLevel !== 'GENERAL') return false;
      return r.isPublished;
    });
  }

  getResourceBySlug(slug: string): DevResource | undefined {
    return this.resources.find((r) => r.slug === slug);
  }

  createResource(data: Omit<DevResource, 'id' | 'createdAt'>): DevResource {
    const newRes: DevResource = {
      ...data,
      id: `res-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.resources.unshift(newRes);
    return newRes;
  }

  // Bullying Reports
  listBullyingReports(): DevBullyingReport[] {
    return this.bullyingReports;
  }

  createBullyingReport(data: Omit<DevBullyingReport, 'id' | 'createdAt'>): DevBullyingReport {
    const newRep: DevBullyingReport = {
      ...data,
      id: `bl-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.bullyingReports.unshift(newRep);
    return newRep;
  }

  // Emotion Checkins
  addEmotionCheckin(data: Omit<DevEmotionCheckin, 'id' | 'createdAt'>): DevEmotionCheckin {
    const newCheckin: DevEmotionCheckin = {
      ...data,
      id: `em-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.emotionCheckins.unshift(newCheckin);
    return newCheckin;
  }

  getEmotionStats(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const c of this.emotionCheckins) {
      counts[c.moodKey] = (counts[c.moodKey] || 0) + 1;
    }
    return counts;
  }

  // Posts (Tâm sự Góc chia sẻ & Trải lòng)
  private posts: any[] = [
    {
      id: 'post_init_01',
      title: 'Áp lực thi thử vào lớp 10',
      content: 'Dạo này bài vở nhiều quá làm em hay bị mất ngủ và hồi hộp mỗi khi làm bài...',
      author: 'Học sinh ẩn danh',
      recipient: 'Cô Nguyễn Thị Thùy Trang (Phòng 692)',
      secretHash: '0d4817d23a1ec28f99c8f0fcba128a176d65c36391a27e753443a595bc0bca50', // code: TS-10A1-DEMO
      status: 'REPLIED',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      createdStr: 'Hôm qua',
      responses: [
        {
          id: 'res_01',
          senderType: 'TEACHER',
          senderName: 'Cô Nguyễn Thị Thùy Trang',
          content: 'Chào em, cô rất hiểu áp lực của em lúc này. Đừng quá lo lắng nhé, hãy dành 15 phút tập hít thở sâu và chia nhỏ mục tiêu ôn tập mỗi ngày. Em có thể ghé phòng 692 để cô trò mình cùng trò chuyện thêm nhé!',
          createdAt: new Date(Date.now() - 43200000).toISOString()
        }
      ]
    }
  ];

  getPosts(): any[] {
    return [...this.posts];
  }

  findPostById(id: string): any | null {
    return this.posts.find(p => p.id === id) || null;
  }

  findPostByHash(hash: string): any | null {
    return this.posts.find(p => p.secretHash === hash) || null;
  }

  createPost(data: any): any {
    const newPost = {
      ...data,
      id: data.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: data.status || 'WAITING',
      createdAt: data.createdAt || new Date().toISOString(),
      createdStr: data.createdStr || new Date().toLocaleString('vi-VN'),
      responses: data.responses || []
    };
    this.posts.unshift(newPost);
    return newPost;
  }

  addPostResponse(postId: string, senderType: 'TEACHER' | 'STUDENT', senderName: string, content: string): any | null {
    const post = this.findPostById(postId);
    if (!post) return null;
    const newRes = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderType,
      senderName,
      content,
      createdAt: new Date().toISOString()
    };
    if (!post.responses) post.responses = [];
    post.responses.push(newRes);
    if (senderType === 'TEACHER') {
      post.status = 'REPLIED';
    } else {
      post.status = 'WAITING';
    }
    post.updatedAt = new Date().toISOString();
    return newRes;
  }

  updatePostStatus(postId: string, status: string): boolean {
    const post = this.findPostById(postId);
    if (!post) return false;
    post.status = status;
    post.updatedAt = new Date().toISOString();
    return true;
  }

  deletePost(postId: string): boolean {
    const idx = this.posts.findIndex(p => p.id === postId);
    if (idx >= 0) {
      this.posts.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Audit Logs
  addAuditLog(username: string, actionType: string, targetResource: string, details?: string) {
    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      username,
      actionType,
      targetResource,
      details: details || null,
      createdAt: new Date().toISOString(),
    });
  }

  getAuditLogs(): DevAuditLog[] {
    return this.auditLogs.slice(0, 50);
  }
}

export const devStore = new DevDataStore();
