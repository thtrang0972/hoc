import React, { useState } from 'react';
import { useAgeMode } from '../context/AgeModeContext';
import { RequestTopic, TOPIC_LABELS, STATUS_LABELS, RequestMessage } from '../types';
import {
  MessageSquare, Search, Lock, Send, CheckCircle2,
  Clock, AlertCircle, Copy, Check
} from 'lucide-react';

// IMPORT CÁC HÀM CỦA FIREBASE
import { db } from '../firebase'; 
import { collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';

export const ShareCorner: React.FC = () => {
  const { isPrimary, mode } = useAgeMode();
  const [activeTab, setActiveTab] = useState<'SUBMIT' | 'TRACK'>('SUBMIT');

  // Submit Form state
  const [topic, setTopic] = useState<RequestTopic>('STUDY_PRESSURE');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [studentAlias, setStudentAlias] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [contactMethod, setContactMethod] = useState('Gặp trực tiếp giờ ra chơi tại Phòng 204');
  const [preferredTime, setPreferredTime] = useState('Giờ ra chơi tiết 2 hoặc tiết 3');
  const [content, setContent] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Track Ticket state
  const [trackCodeInput, setTrackCodeInput] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<{
    id: string; // ID thật của tài liệu trên Firestore
    requestCode: string;
    topic: string;
    gradeLevel: string;
    status: keyof typeof STATUS_LABELS;
    studentAlias?: string;
    preferredTime?: string;
    content: string;
    createdAt: string;
    messages: RequestMessage[];
  } | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // 1. GỬI PHIẾU LÊN FIREBASE
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      // Sinh mã bảo mật ngẫu nhiên
      const secretCode = "TS-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const timestamp = new Date().toISOString();

      // Ghi thẳng vào bộ sưu tập 'counseling_posts' trên Firestore
      await addDoc(collection(db, 'counseling_posts'), {
        secretCode: secretCode,
        gradeLevel: mode,
        topic: TOPIC_LABELS[topic] || topic,
        isAnonymous: isAnonymous,
        studentAlias: studentAlias || (isAnonymous ? 'Học sinh ẩn danh' : 'Em học sinh'),
        studentClass: studentClass,
        contactMethod: contactMethod,
        preferredTime: preferredTime,
        content: content,
        status: 'RECEIVED',
        createdAt: timestamp,
        messages: [] // Mảng rỗng chứa tin nhắn 2 chiều sau này
      });

      setSubmittedCode(secretCode);
      setContent('');
    } catch (err) {
      console.error("Lỗi khi lưu Firebase:", err);
      alert('Không thể lưu dữ liệu. Vui lòng kiểm tra lại kết nối mạng!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. TRA CỨU TỪ FIREBASE
  const handleTrackRequest = async (e?: React.FormEvent, codeToUse?: string) => {
    if (e) e.preventDefault();
    const code = (codeToUse || trackCodeInput).trim().toUpperCase();
    if (!code) return;

    setIsTracking(true);
    setTrackError(null);

    try {
      // Truy vấn tìm tài liệu có secretCode trùng khớp
      const q = query(collection(db, 'counseling_posts'), where('secretCode', '==', code));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        
        setTrackResult({
          id: docSnap.id,
          requestCode: data.secretCode,
          topic: data.topic,
          gradeLevel: data.gradeLevel,
          status: data.status || 'RECEIVED',
          studentAlias: data.studentAlias,
          preferredTime: data.preferredTime,
          content: data.content,
          createdAt: data.createdAt,
          messages: data.messages || [],
        });
      } else {
        setTrackResult(null);
        setTrackError('Không tìm thấy bài tâm sự với mã tra cứu này.');
      }
    } catch (error) {
      console.error("Lỗi tra cứu Firebase:", error);
      setTrackError('Lỗi kết nối máy chủ dữ liệu.');
    } finally {
      setIsTracking(false);
    }
  };

  // 3. GỬI TIN NHẮN PHẢN HỒI LÊN FIREBASE
  const handleSendFollowUpMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !trackResult) return;

    setIsReplying(true);
    try {
      const postRef = doc(db, 'counseling_posts', trackResult.id);
      const newMessage = {
        id: Date.now().toString(),
        senderType: 'STUDENT',
        senderName: trackResult.studentAlias || 'Em học sinh',
        message: replyText.trim(),
        createdAt: new Date().toISOString()
      };

      // Cập nhật mảng messages trong tài liệu Firestore hiện tại
      await updateDoc(postRef, {
        messages: arrayUnion(newMessage)
      });

      // Cập nhật lại giao diện
      setTrackResult({
        ...trackResult,
        messages: [...trackResult.messages, newMessage as any],
      });
      setReplyText('');
    } catch (err) {
      console.error("Lỗi gửi tin nhắn Firebase:", err);
      alert("Lỗi khi gửi lời nhắn.");
    } finally {
      setIsReplying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-sky-50 text-sky-800 rounded-full text-xs font-bold border border-sky-200">
          <MessageSquare className="w-4 h-4 text-sky-600" />
          <span>Góc Chia Sẻ & Hòm Thư Bí Mật</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {isPrimary ? 'Gửi Lời Nhắn Đến Thầy Cô' : 'Gửi Phiếu Tư Vấn & Tra Cứu Tiến Độ'}
        </h1>
        <p className="text-sm text-slate-600">
          Mỗi lời tâm sự đều được mã hóa bằng mã tra cứu riêng biệt. Em hoàn toàn có thể ẩn danh và nhận phản hồi an toàn.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex justify-center">
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('SUBMIT')}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'SUBMIT'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Gửi tâm sự mới</span>
          </button>
          <button
            onClick={() => setActiveTab('TRACK')}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'TRACK'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Tra cứu theo mã phiếu</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SUBMIT FORM */}
      {activeTab === 'SUBMIT' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          {submittedCode ? (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">
                  Phiếu Chia Sẻ Đã Được Gửi Thành Công!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                  Thầy cô đã tiếp nhận an toàn. Hãy lưu lại mã bí mật bên dưới để theo dõi phản hồi của thầy cô nhé!
                </p>
              </div>

              {/* Code Box */}
              <div className="bg-slate-50 border-2 border-dashed border-sky-300 rounded-3xl p-6 max-w-sm mx-auto space-y-3">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Mã tra cứu bảo mật của em
                </span>
                <div className="text-3xl font-black text-sky-700 tracking-wider font-mono">
                  {submittedCode}
                </div>
                <button
                  onClick={() => copyToClipboard(submittedCode)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã tra cứu'}</span>
                </button>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setTrackCodeInput(submittedCode);
                    setActiveTab('TRACK');
                    handleTrackRequest(undefined, submittedCode);
                  }}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Chuyển sang theo dõi tiến độ phiếu này
                </button>
                <button
                  onClick={() => setSubmittedCode(null)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Gửi thêm phiếu khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              {/* Anonymous toggle */}
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-sky-700 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-sky-950">Chế độ bảo vệ danh tính:</h4>
                    <p className="text-[11px] text-sky-800">
                      Em có thể giấu tên thật và sử dụng biệt danh yêu thích.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-sky-900">Giấu tên thật (Ẩn danh)</span>
                </label>
              </div>

              {/* Identity row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isAnonymous ? 'Tên hoặc Biệt danh tự chọn (Ví dụ: Cỏ May, Bạn Gấu)' : 'Họ và tên của em:'}
                  </label>
                  <input
                    type="text"
                    value={studentAlias}
                    onChange={(e) => setStudentAlias(e.target.value)}
                    placeholder={isAnonymous ? 'Bạn Cỏ May 7A' : 'Trần Hoài An'}
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lớp / Khối lớp (Tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder="Ví dụ: 7A2, hoặc Khối 8"
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Topic Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chủ đề em muốn chia sẻ cùng thầy cô:
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as RequestTopic)}
                  className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50 font-medium"
                >
                  {Object.entries(TOPIC_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Method & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phương thức liên hệ an toàn:
                  </label>
                  <select
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  >
                    <option value="Gặp trực tiếp giờ ra chơi tại Phòng 204">Gặp trực tiếp tại Phòng 204</option>
                    <option value="Trao đổi qua mục Tra cứu theo mã phiếu này">Chỉ trao đổi qua mã tra cứu trên web</option>
                    <option value="Hòm thư điện tử bảo mật">Hòm thư điện tử riêng</option>
                    <option value="Nhắn tin qua số điện thoại kín">Số điện thoại kín</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Khung giờ em cảm thấy thuận tiện nhất:
                  </label>
                  <input
                    type="text"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    placeholder="Ví dụ: Giờ ra chơi tiết 3, sau 16h30 thứ Năm..."
                    className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung điều em muốn chia sẻ (Càng chi tiết thầy cô càng hiểu rõ):
                </label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    isPrimary
                      ? 'Em hãy viết ra những điều khiến em băn khoăn hay khó chịu ở trường hoặc ở nhà nhé...'
                      : 'Mô tả tình huống đang xảy ra, cảm xúc của bạn và điều bạn mong muốn nhận được từ thầy cô...'
                  }
                  className="w-full text-xs sm:text-sm p-4 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />
              </div>

              {/* Privacy agreement checkbox */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAgreed}
                    onChange={(e) => setPrivacyAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-sky-600 rounded cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Em xác nhận nội dung chia sẻ là trung thực và đồng ý để thầy cô hỗ trợ theo quy trình bảo mật của trường.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !content.trim() || !privacyAgreed}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-sky-200 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu vào hệ thống an toàn...' : 'Gửi phiếu chia sẻ ngay'}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: TRACK TICKET */}
      {activeTab === 'TRACK' && (
        <div className="space-y-6">
          {/* Tracking Search Input */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Tra Cứu Trạng Thái & Lời Nhắn
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Nhập mã định danh bắt đầu bằng <strong>TS-</strong> đã được cấp khi em gửi phiếu.
            </p>

            <form onSubmit={handleTrackRequest} className="flex gap-2">
              <input
                type="text"
                value={trackCodeInput}
                onChange={(e) => setTrackCodeInput(e.target.value.toUpperCase())}
                placeholder="Ví dụ: TS-H6W9-6KFA"
                className="flex-1 text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 uppercase font-mono font-bold"
              />
              <button
                type="submit"
                disabled={isTracking || !trackCodeInput.trim()}
                className="px-6 py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>{isTracking ? 'Đang tìm...' : 'Tra cứu'}</span>
              </button>
            </form>

            {trackError && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{trackError}</span>
              </div>
            )}
          </div>

          {/* Ticket Detail & Messages */}
          {trackResult && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-black text-slate-900">
                      {trackResult.requestCode}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold border ${
                        STATUS_LABELS[trackResult.status]?.color || 'bg-slate-100'
                      }`}
                    >
                      {STATUS_LABELS[trackResult.status]?.label || trackResult.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Chủ đề: <strong>{trackResult.topic}</strong> • Người gửi:{' '}
                    <strong>{trackResult.studentAlias}</strong>
                  </p>
                </div>
                <div className="text-[11px] text-slate-400">
                  Gửi lúc: {new Date(trackResult.createdAt).toLocaleDateString('vi-VN')}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-slate-700 flex items-start gap-3">
                <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sky-950">Tiến trình xử lý:</h4>
                  <p className="text-slate-600 mt-0.5">
                    {STATUS_LABELS[trackResult.status]?.desc || 'Thầy cô đang xem xét.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Nội dung em đã gửi:
                </span>
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {trackResult.content}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-600" />
                  <span>Trao đổi 2 chiều cùng Thầy Cô tư vấn:</span>
                </h3>

                {trackResult.messages.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    Chưa có tin nhắn mới từ thầy cô. Thầy cô thường phản hồi trong vòng 24 giờ học đường.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackResult.messages.map((m) => {
                      const isCounselor = m.senderType === 'TEACHER' || m.senderType === 'COUNSELOR';
                      return (
                        <div
                          key={m.id || Math.random()}
                          className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                            isCounselor
                              ? 'bg-sky-50/80 border-sky-200 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5 font-bold">
                            <span className={isCounselor ? 'text-sky-800' : 'text-slate-700'}>
                              {m.senderName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(m.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p className="whitespace-pre-line text-slate-700">{m.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form onSubmit={handleSendFollowUpMessage} className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Gửi thêm lời nhắn hoặc câu hỏi cho thầy cô..."
                    className="flex-1 text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={isReplying || !replyText.trim()}
                    className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isReplying ? 'Đang gửi...' : 'Gửi thêm'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
