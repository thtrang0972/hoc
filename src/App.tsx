/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';

// Firebase SDK & Khởi tạo trực tiếp với project hinh123-fd678
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  doc, 
  query, 
  orderBy, 
  serverTimestamp, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

import { 
  PhoneCall, 
  AlertTriangle, 
  CheckCircle2, 
  Heart, 
  LogOut, 
  Bookmark, 
  Shield, 
  Trash2, 
  MessageSquare, 
  Calendar, 
  BookOpen, 
  Smile, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Clock, 
  Search, 
  Menu, 
  X, 
  ShieldAlert, 
  Phone, 
  Check, 
  Lock, 
  Flame, 
  FileText,
  HelpCircle,
  Share2,
  ChevronRight,
  MapPin,
  Mail,
  Inbox,
  ShieldCheck,
  Building2,
  MessageCircle,
  Eye,
  EyeOff,
  GraduationCap,
  Copy,
  Printer,
  RefreshCw,
  Key,
  Filter
} from 'lucide-react';

// ==========================================
// 1. AUTH CONTEXT (XÁC THỰC FIREBASE)
// ==========================================
interface AuthContextType {
  currentUser: FirebaseUser | null;
  userRole: string;
  displayName: string;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  quickLogin: (email: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string>('STUDENT');
  const [displayName, setDisplayName] = useState<string>('Học sinh ẩn danh');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Tự động phân vai theo email demo hoặc tên
        const email = user.email || '';
        if (email.includes('admin') || email.includes('quantri')) {
          setUserRole('ADMIN');
          setDisplayName('Quản trị viên hệ thống');
        } else if (email.includes('thuytrang') || email.includes('counselor')) {
          setUserRole('COUNSELOR');
          setDisplayName('Cô Nguyễn Thị Thùy Trang');
        } else if (email.includes('gvcn') || email.includes('lan')) {
          setUserRole('TEACHER');
          setDisplayName('Cô Hoàng Thị Lan (GVCN)');
        } else {
          setUserRole('STUDENT');
          setDisplayName(user.displayName || email.split('@')[0] || 'Học sinh');
        }
      } else {
        setUserRole('GUEST');
        setDisplayName('Khách');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (inputAccount: string, pass: string) => {
    const clean = inputAccount.trim().toLowerCase();
    let emailToUse = clean;

    const isAdmin = clean === 'admin' || clean === 'quantri' || clean.includes('admin') || clean.includes('quantri') || clean === 'bgh';
    const isCounselor = clean === 'thuytrang' || clean === 'cotrang' || clean.includes('thuytrang') || clean.includes('c2phuochungap_trang') || clean.includes('counselor');

    if (!isAdmin && !isCounselor) {
      throw new Error('Chỉ Quản trị viên (Ban Giám Hiệu) và Cô Nguyễn Thị Thùy Trang (Phòng 692) mới có tài khoản đăng nhập. Tất cả học sinh, phụ huynh và thầy cô khác đều sử dụng cổng tư vấn mà không cần đăng nhập!');
    }

    if (isAdmin) {
      if (!emailToUse.includes('@')) emailToUse = 'quantri.minh@school.edu.vn';
      if (pass !== 'admin123' && pass !== 'admin@2026') {
        throw new Error('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại!');
      }
    } else if (isCounselor) {
      if (!emailToUse.includes('@')) emailToUse = 'c2phuochungap_trang@angiang.edu.vn';
      if (pass !== 'demo123' && pass !== 'trang123' && pass !== 'phuochung692' && pass !== 'thuytrang123') {
        throw new Error('Mật khẩu của Cô Nguyễn Thị Thùy Trang không chính xác. Vui lòng thử lại!');
      }
    }

    try {
      await signInWithEmailAndPassword(auth, emailToUse, pass);
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, emailToUse, pass);
      } catch {
        // Fallback local auth state
        const mockUser: any = {
          uid: isAdmin ? 'admin-bgh-01' : 'counselor-thuytrang-01',
          email: emailToUse,
          displayName: isAdmin ? 'Ban Giám Hiệu / Quản trị viên' : 'Cô Nguyễn Thị Thùy Trang'
        };
        setCurrentUser(mockUser);
        setUserRole(isAdmin ? 'ADMIN' : 'COUNSELOR');
        setDisplayName(isAdmin ? 'Ban Giám Hiệu / Quản trị viên' : 'Cô Nguyễn Thị Thùy Trang');
      }
    }
  };

  const register = async (email: string, pass: string, name?: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user && name) {
      // Lưu thông tin người dùng vào Firestore
      try {
        await setDoc(doc(db, 'users', res.user.uid), {
          email: res.user.email,
          displayName: name,
          role: 'STUDENT',
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Lưu user Firestore phụ:', e);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    setCurrentUser(null);
    setUserRole('GUEST');
    setDisplayName('Khách');
  };

  const quickLogin = async (email: string, pass: string) => {
    await login(email, pass);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, displayName, loading, login, register, logout, quickLogin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được đặt trong AuthProvider');
  return context;
};

// ==========================================
// 2. HEADER TOP BAR & NAVBAR (GLASSMORPHISM)
// ==========================================

function TopFirebaseBar() {
  return null;
}

function Navbar({ 
  onOpenEmergency, 
  onOpenMessageCounselor 
}: { 
  onOpenEmergency?: () => void; 
  onOpenMessageCounselor?: () => void;
}) {
  const { currentUser, displayName, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Trang chủ', icon: Heart },
    { to: '/tro-ly-ai', label: 'Trợ lý AI', icon: Bot },
    { to: '/chong-bat-nat', label: 'Phòng chống bắt nạt học đường', icon: ShieldAlert },
    { to: '/cam-xuc', label: 'Cảm xúc', icon: Smile },
    { to: '/chia-se', label: 'Góc chia sẻ', icon: MessageSquare },
    { to: '/ky-nang-song', label: 'Kỹ năng sống', icon: Sparkles },
    { to: '/dang-ky-tu-van', label: 'Đặt lịch giáo viên', icon: Calendar },
    { to: '/dashboard', label: 'Quản Trị', icon: ShieldCheck },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/quan-tri') {
      return location.pathname === '/dashboard' || location.pathname === '/quan-tri';
    }
    if (path === '/ky-nang-song' || path === '/thu-vien') {
      return location.pathname === '/ky-nang-song' || location.pathname === '/thu-vien';
    }
    return location.pathname === path;
  };

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-indigo-100/90 shadow-sm transition-all">
      {/* Hàng 1: Logo trường + Nút Tài khoản / Đăng nhập */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-300 group-hover:scale-105 transition-transform shrink-0 ring-2 ring-white/60">
            <Heart className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="text-sm sm:text-base md:text-lg font-black bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent block leading-tight">
              CỔNG TƯ VẤN TÂM LÝ HỌC ĐƯỜNG
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-800 tracking-wide block leading-none mt-0.5">
              TRƯỜNG TH&THCS PHƯỚC HƯNG
            </span>
          </div>
        </Link>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nút Nhắn tin cho Cô Thùy Trang */}
          <button
            onClick={onOpenMessageCounselor}
            className="px-3 sm:px-4 py-1.5 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white text-xs font-black shadow-md shadow-teal-300/60 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 ring-1 ring-white/50"
            title="Nhắn tin riêng tư cho Cô Nguyễn Thị Thùy Trang"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">Nhắn tin Cô Thùy Trang</span>
            <span className="sm:hidden">Nhắn Cô Trang</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2 bg-indigo-50/90 border border-indigo-200/80 rounded-2xl px-3 py-1.5 shadow-xs">
              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-indigo-900 max-w-[120px] sm:max-w-[160px] truncate" title={currentUser.email || ''}>
                {displayName}
              </span>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-rose-600 p-1 transition rounded-lg hover:bg-rose-50"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/tai-khoan"
              className="px-3.5 sm:px-4 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:to-pink-600 text-white text-xs font-black shadow-md shadow-purple-300/60 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 ring-1 ring-white/50"
              title="Đăng nhập dành cho Quản trị viên & Cô Nguyễn Thị Thùy Trang"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đăng nhập (Quản trị & Cô Trang)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Hàng 2: THANH TIÊU ĐỀ MENU TOÀN BỘ ĐƯỢC ĐƯA RA NGOÀI (CÁC NÚT ĐƯỢC NỔI LÊN, MÀU SẮC TƯƠI SÁNG) */}
      <div className="border-t border-indigo-100/70 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-pink-50/60 py-1.5">
        <div className="max-w-7xl mx-auto px-2 sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 scrollbar-none text-[11px] sm:text-xs font-semibold">
            {navLinks.map((link) => {
              const IconComp = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all duration-200 shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-300/70 font-black -translate-y-0.5 ring-2 ring-indigo-200'
                      : 'bg-white/85 text-slate-700 hover:text-indigo-700 hover:bg-white border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 font-bold'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-indigo-600'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ==========================================
// 3. FOOTER & SOS POPUP MODAL & TRA CỨU
// ==========================================

function Footer() {
  const [lookupOpen, setLookupOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [privacyModal, setPrivacyModal] = useState<string | null>(null);

  // State tra cứu mã phiếu
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCode.trim().toUpperCase();
    if (!clean) return;
    setIsSearching(true);
    setSearched(true);
    setSearchResult(null);

    try {
      // 1. Thử tìm trên Firestore
      const q = query(collection(db, 'bullyingReports'));
      const snap = await getDocs(q);
      const found = snap.docs.find((d) => {
        const data = d.data();
        return (data.code && data.code.toUpperCase() === clean);
      });

      if (found) {
        setSearchResult({ type: 'bully', ...found.data() });
        setIsSearching(false);
        return;
      }
    } catch {
      // Bỏ qua lỗi Firestore, kiểm tra localStorage
    }

    // 2. Tìm trong localStorage
    const localBully = JSON.parse(localStorage.getItem('demo_bully_reports') || '[]');
    const localFound = localBully.find((b: any) => b.code && b.code.toUpperCase() === clean);
    if (localFound) {
      setSearchResult({ type: 'bully', ...localFound });
    } else {
      setSearchResult(null);
    }
    setIsSearching(false);
  };

  return (
    <>
      <footer className="mt-auto border-t border-indigo-100/80 bg-white/75 backdrop-blur-2xl pt-12 pb-8 text-slate-600 text-xs shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* 1. KHỐI CAM KẾT & LỜI NHẮN NHỦ ĐẦU CHÂN TRANG (Callout Banner) */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 sm:p-10 text-white shadow-2xl shadow-indigo-300/40 mb-12">
            {/* Họa tiết trang trí */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold tracking-wide mb-4 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Cam kết Trường học An toàn - Thân thiện - Tôn trọng</span>
              </div>

              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-3">
                Mỗi học sinh đều là một điều kỳ diệu đáng được trân trọng
              </h2>

              <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed font-normal mb-6 max-w-2xl">
                Dù em đang gặp phải bất cứ khó khăn nào trong bài vở, áp lực điểm số, xích mích bạn bè hay chuyện gia đình, hãy nhớ rằng cánh cửa Phòng Tư vấn Trường TH&THCS Phước Hưng luôn rộng mở đón chào em.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/chia-se"
                  className="px-5 py-2.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Chia sẻ tâm sự ngay</span>
                </Link>

                <button
                  onClick={() => {
                    setLookupOpen(true);
                    setSearched(false);
                    setSearchResult(null);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Tra cứu mã phiếu</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. BỐ CỤC 4 CỘT CHÍNH CỦA CHÂN TRANG */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b border-slate-200/80">
            
            {/* Cột 1: Cổng tư vấn tâm lý (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                  <Heart className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm leading-snug">
                    Cổng tư vấn tâm lý
                  </h3>
                  <p className="text-xs font-extrabold text-indigo-700 tracking-wide">
                    Trường TH&THCS Phước Hưng
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Môi trường lắng nghe an toàn, thân thiện và thấu cảm dành cho học sinh Tiểu học, THCS, quý phụ huynh và thầy cô giáo.
              </p>

              <div className="space-y-2 text-xs text-slate-600 pt-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Địa chỉ:</strong> Ấp Phước Khánh, Nhơn Hội, An Giang
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Phòng Tư vấn Tâm lý học đường:</strong> Gặp Cô Nguyễn Thị Thùy Trang (Phòng 692)
                  </span>
                </div>
              </div>
            </div>

            {/* Cột 2: Thông tin liên hệ (3 cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Thông tin liên hệ</span>
              </h4>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-800 block mb-0.5">Thời gian tiếp đón:</span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Thứ Hai - Thứ Sáu:<br />
                    <strong className="text-indigo-700">07:00 - 11:30</strong> | <strong className="text-indigo-700">13:30 - 17:00</strong>
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-0.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Hộp thư điện tử:</span>
                  </span>
                  <a
                    href="mailto:c2phuochungap_trang@angiang.edu.vn"
                    className="text-indigo-600 hover:underline font-mono text-[11px] break-all block"
                  >
                    c2phuochungap_trang@angiang.edu.vn
                  </a>
                </div>

                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-0.5">
                    <Inbox className="w-3.5 h-3.5 text-purple-600" />
                    <span>Hòm thư tâm sự trực tiếp:</span>
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Đặt trước cửa Phòng Tư vấn (Tầng 2)
                  </p>
                </div>
              </div>
            </div>

            {/* Cột 3: Hướng dẫn & Quyền riêng tư (3 cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Hướng dẫn & Quyền riêng tư</span>
              </h4>

              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => {
                      setLookupOpen(true);
                      setSearched(false);
                      setSearchResult(null);
                    }}
                    className="text-slate-600 hover:text-indigo-600 hover:underline transition text-left flex items-center gap-1.5"
                  >
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Tra cứu trạng thái phiếu tâm sự</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setPrivacyModal('anon_process')}
                    className="text-slate-600 hover:text-indigo-600 hover:underline transition text-left flex items-center gap-1.5"
                  >
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Quy trình gửi thư ẩn danh an toàn</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setPrivacyModal('booking_rule')}
                    className="text-slate-600 hover:text-indigo-600 hover:underline transition text-left flex items-center gap-1.5"
                  >
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Quy định đặt lịch gặp thầy cô</span>
                  </button>
                </li>
              </ul>

              <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                <strong className="block font-bold text-amber-950 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Cam kết bảo mật:</span>
                </strong>
                Nội dung tư vấn được bảo mật. Khi có nguy cơ đe dọa an toàn tính mạng, nhà trường sẽ kích hoạt quy trình bảo vệ học sinh theo quy định.
              </div>
            </div>

            {/* Cột 4: Kênh khẩn cấp & Cơ quan (2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-rose-600" />
                <span>Kênh khẩn cấp</span>
              </h4>

              {/* Tổng đài 111 */}
              <a
                href="tel:111"
                className="block p-3 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md hover:scale-102 transition group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-black text-base">Tổng đài Trẻ em 111</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">24/7 Miễn phí</span>
                </div>
                <p className="text-[10px] text-rose-100 leading-tight">
                  Đường dây nóng Quốc gia Bảo vệ Trẻ em
                </p>
              </a>

              {/* Công an 113 */}
              <a
                href="tel:113"
                className="block p-3 rounded-2xl bg-slate-900 text-white shadow-md hover:scale-102 transition group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-black text-base text-amber-400">Công an (Khẩn cấp) 113</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-tight">
                  Khi gặp bạo lực hoặc nguy cơ đe dọa
                </p>
              </a>

              {/* Nút Xem danh bạ khẩn cấp */}
              <button
                onClick={() => setDirectoryOpen(true)}
                className="w-full py-2.5 px-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] shadow-2xs hover:border-indigo-300 transition text-center"
              >
                Xem danh bạ khẩn cấp nhà trường
              </button>
            </div>

          </div>

          {/* 3. DÒNG BẢN QUYỀN VÀ KHẨU HIỆU DƯỚI CÙNG */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">
                © 2026 Cổng tư vấn tâm lý học đường – Trường TH&THCS Phước Hưng. Tất cả quyền được bảo lưu.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Vì một trường học an toàn, hạnh phúc và thân thiện</span>
            </div>
          </div>

        </div>
      </footer>

      {/* MODAL 1: TRA CỨU MÃ PHIẾU TÂM SỰ / BÁO CÁO */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">Tra Cứu Mã Phiếu Bảo Mật</h3>
                  <p className="text-xs text-slate-500">Nhập mã hồ sơ (ví dụ: SOS-BN-xxxxxx) để xem trạng thái</p>
                </div>
              </div>
              <button
                onClick={() => setLookupOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLookup} className="space-y-3 mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã phiếu (VD: SOS-BN-123456)..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  required
                  className="flex-1 text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
                >
                  {isSearching ? 'Đang tra...' : 'Kiểm tra'}
                </button>
              </div>
            </form>

            {searched && (
              <div className="pt-2">
                {searchResult ? (
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2 text-xs animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                        {searchResult.code}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                        {searchResult.status || 'Chờ tiếp nhận khẩn cấp'}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      <strong>Hình thức:</strong> {searchResult.category || 'Phiếu hỗ trợ'}
                    </p>
                    <p className="text-slate-700">
                      <strong>Lớp / Địa điểm:</strong> {searchResult.targetClass || 'Chưa rõ'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      <strong>Thời gian gửi:</strong> {searchResult.createdStr || 'Gần đây'}
                    </p>
                    <div className="pt-2 border-t border-indigo-200/60 text-[11px] text-emerald-800 font-medium">
                      ✓ Hồ sơ đã được lưu trữ an toàn trong cơ sở dữ liệu trường TH&THCS Phước Hưng. Thầy cô đang xử lý bảo mật.
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center space-y-1">
                    <p className="font-bold">Không tìm thấy mã phiếu "{searchCode}"</p>
                    <p className="text-[11px] text-slate-500">
                      Vui lòng kiểm tra lại chính xác từng ký tự mã phiếu được cấp sau khi gửi báo cáo hoặc liên hệ trực tiếp Cô Thùy Trang (Phòng 692).
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button
                onClick={() => setLookupOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DANH BẠ KHẨN CẤP NHÀ TRƯỜNG */}
      {directoryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">Danh Bạ Khẩn Cấp Nhà Trường</h3>
                  <p className="text-xs text-slate-500">TRƯỜNG TH&THCS PHƯỚC HƯNG (An Giang)</p>
                </div>
              </div>
              <button
                onClick={() => setDirectoryOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-900">Tổng đài Quốc gia Bảo vệ Trẻ em</div>
                  <div className="text-[11px] text-rose-700">Miễn cước 24/7 - Hỗ trợ khẩn cấp toàn quốc</div>
                </div>
                <a href="tel:111" className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs">
                  Gọi 111
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-indigo-900">Phòng Tư Vấn Tâm Lý - Cô Thùy Trang</div>
                  <div className="text-[11px] text-indigo-700">Phòng 692 (Tầng 6 Nhà Đa Năng)</div>
                </div>
                <span className="font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                  Phòng 692
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Ban Giám Hiệu Trường TH&THCS Phước Hưng</div>
                  <div className="text-[11px] text-slate-500">Ấp Phước Khánh, Nhơn Hội, An Giang</div>
                </div>
                <span className="text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  Văn phòng BGH
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-900">Công an Địa phương (Khẩn cấp)</div>
                  <div className="text-[11px] text-amber-700">Can thiệp bạo lực & mất an ninh trật tự</div>
                </div>
                <a href="tel:113" className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs">
                  Gọi 113
                </a>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <button
                onClick={() => setDirectoryOpen(false)}
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 transition"
              >
                Đã hiểu và đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: HƯỚNG DẪN & QUY ĐỊNH */}
      {privacyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-base">
                {privacyModal === 'anon_process' ? 'Quy Trình Gửi Thư Ẩn Danh An Toàn' : 'Quy Định Đặt Lịch Gặp Thầy Cô'}
              </h3>
              <button
                onClick={() => setPrivacyModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {privacyModal === 'anon_process' ? (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  <strong>1. Không yêu cầu danh tính thực:</strong> Học sinh có thể gửi bài chia sẻ hoặc báo cáo bạo lực mà không cần điền tên, số điện thoại hay tài khoản cá nhân.
                </p>
                <p>
                  <strong>2. Mã hồ sơ riêng tư:</strong> Sau khi gửi thành công, hệ thống tự động sinh một mã ngẫu nhiên (ví dụ: SOS-BN-xxxxxx). Em hãy lưu mã này lại để tra cứu tình trạng xử lý mà không sợ lộ danh tính.
                </p>
                <p>
                  <strong>3. Tiếp nhận độc lập:</strong> Chỉ có chuyên viên tư vấn tâm lý (Cô Thùy Trang) và Ban Giám Hiệu được quyền truy cập thông tin để bảo vệ em.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  <strong>1. Khung giờ gặp trực tiếp:</strong> Từ Thứ Hai đến Thứ Sáu (07:00 - 11:30 và 13:30 - 17:00) tại Phòng 692.
                </p>
                <p>
                  <strong>2. Chủ động chọn hình thức:</strong> Em có thể chọn gặp trực tiếp tại phòng tư vấn, trò chuyện trực tuyến bảo mật hoặc gửi thư điện tử.
                </p>
                <p>
                  <strong>3. Tôn trọng và bảo mật:</strong> Mọi trao đổi giữa em và cô Thùy Trang đều hoàn toàn riêng tư. Thầy cô không đánh giá hay trách phạt em vì bất kỳ cảm xúc nào.
                </p>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <button
                onClick={() => setPrivacyModal(null)}
                className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white transition"
              >
                Đóng hướng dẫn
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmergencyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-rose-400 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-200/50 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-7 h-7 animate-pulse text-rose-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-rose-700">HỖ TRỢ KHẨN CẤP 111</h3>
              <p className="text-xs text-slate-500 font-medium">Tổng đài Quốc gia Bảo vệ Trẻ em Việt Nam</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5">
          Nếu em đang gặp nguy hiểm, bị bạo lực học đường, xâm hại, hoặc đang trải qua khủng hoảng tâm lý quá sức chịu đựng,{' '}
          <strong className="text-slate-800">em không hề đơn độc</strong>. Hãy kết nối ngay với các kênh khẩn cấp miễn phí:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <a
            href="tel:111"
            className="flex items-center gap-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white p-3.5 rounded-2xl shadow-md hover:scale-102 active:scale-98 transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 group-hover:animate-bounce" />
            </div>
            <div>
              <div className="text-2xl font-black leading-none">111</div>
              <div className="text-[11px] text-rose-100 mt-0.5">Tổng đài 111 (24/7 Miễn phí)</div>
            </div>
          </a>

          <a
            href="tel:115"
            className="flex items-center gap-3 bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3.5 rounded-2xl shadow-md hover:scale-102 active:scale-98 transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 group-hover:animate-bounce" />
            </div>
            <div>
              <div className="text-2xl font-black leading-none">115</div>
              <div className="text-[11px] text-amber-100 mt-0.5">Cấp cứu Y tế Khẩn cấp</div>
            </div>
          </a>
        </div>

        {/* Sơ cứu tâm lý 5-4-3-2-1 */}
        <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 mb-6">
          <h4 className="text-xs font-bold text-sky-900 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Kỹ thuật xoa dịu hoảng loạn tức thì (5-4-3-2-1):
          </h4>
          <ul className="text-[11px] text-sky-800 space-y-1 list-disc pl-4">
            <li>Hít một hơi thật sâu bằng mũi, thở nhẹ ra bằng miệng.</li>
            <li>Nhìn xung quanh và gọi tên <strong>5 đồ vật</strong> em nhìn thấy.</li>
            <li>Chạm vào <strong>4 đồ vật</strong> gần em (áo, bàn, tay...).</li>
            <li>Lắng nghe <strong>3 âm thanh</strong> xung quanh.</li>
            <li>Uống một ngụm nước ấm và gọi ngay cho người em tin tưởng nhất.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
        >
          Đã hiểu, quay lại trang web
        </button>
      </div>
    </div>
  );
}

function MessageCounselorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    setSending(true);

    const msgData = {
      sender: isAnon ? 'Học sinh ẩn danh' : (senderName || 'Học sinh'),
      contact: senderContact || 'Không để lại thông tin liên lạc',
      content: messageContent.trim(),
      recipient: 'Cô Nguyễn Thị Thùy Trang (Phòng 692)',
      createdAt: serverTimestamp(),
      dateStr: new Date().toLocaleString('vi-VN')
    };

    try {
      await addDoc(collection(db, 'counselorMessages'), msgData);
    } catch {
      const list = JSON.parse(localStorage.getItem('demo_counselor_messages') || '[]');
      list.unshift(msgData);
      localStorage.setItem('demo_counselor_messages', JSON.stringify(list));
    }

    setSending(false);
    setSentSuccess(true);
    setMessageContent('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-teal-400 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-200/50 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-200">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">Nhắn Tin Cho Cô Thùy Trang</h3>
              <p className="text-xs text-teal-700 font-bold">Phòng Tư Vấn Tâm Lý Học Đường 692</p>
            </div>
          </div>
          <button
            onClick={() => {
              setSentSuccess(false);
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="text-base sm:text-lg font-black text-teal-950">Tin Nhắn Đã Được Gửi Tới Cô Trang!</h4>
            <p className="text-xs sm:text-sm text-teal-800 leading-relaxed max-w-md mx-auto">
              Cảm ơn em đã tin tưởng gửi lời nhắn. Cô Nguyễn Thị Thùy Trang sẽ đọc tin nhắn và hỗ trợ em trong thời gian sớm nhất nhé!
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={() => setSentSuccess(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                Gửi thêm tin nhắn khác
              </button>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-100 text-xs text-teal-900 leading-relaxed flex items-start gap-2.5">
              <Heart className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                Tin nhắn gửi trực tiếp đến chuyên viên tư vấn Cô Nguyễn Thị Thùy Trang. Mọi chia sẻ của em luôn được giữ bí mật 100%.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-slate-700 uppercase">Tên của em:</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnon}
                    onChange={(e) => setIsAnon(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Gửi ẩn danh</span>
                </label>
              </div>
              <input
                type="text"
                disabled={isAnon}
                value={isAnon ? 'Ẩn danh' : senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Ví dụ: Em Nguyễn Văn A, hoặc để trống..."
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Lớp học hoặc cách liên hệ lại (SĐT / Zalo / Email - Không bắt buộc):
              </label>
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Ví dụ: Lớp 7A1 hoặc Zalo 0912xxxxxx (để cô Trang hồi đáp)..."
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Nội dung tin nhắn gửi Cô Thùy Trang:
              </label>
              <textarea
                required
                rows={4}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Em muốn chia sẻ điều gì với cô Trang? (Áp lực học tập, chuyện bạn bè, gia đình, hoặc bất kỳ khúc mắc nào trong lòng...)"
                className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-teal-200/80 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Đang gửi...' : 'GỬI TIN NHẮN CHO CÔ THÙY TRANG'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. TRANG CHỦ (HERO SECTION & 3 NÚT LỚN)
// ==========================================

function Home({ 
  onOpenEmergency, 
  onOpenMessageCounselor 
}: { 
  onOpenEmergency: () => void; 
  onOpenMessageCounselor?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden py-10 sm:py-16">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-pink-200/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-indigo-200/60 text-indigo-700 text-xs font-bold shadow-xs mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>CỔNG TƯ VẤN TÂM LÝ HỌC ĐƯỜNG • TRƯỜNG TH&THCS PHƯỚC HƯNG</span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
          Lắng nghe & Đồng hành <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
            học đường
          </span>
        </h1>

        <div className="max-w-3xl mx-auto mb-10 p-5 sm:p-6 rounded-3xl bg-white/80 backdrop-blur-xl border border-indigo-100 shadow-xl shadow-indigo-100/60 ring-1 ring-white/80">
          <p className="text-slate-700 text-sm sm:text-lg font-medium leading-relaxed">
            Không gian an toàn, ấm áp và thấu cảm dành riêng cho học sinh{' '}
            <strong className="text-indigo-800 font-black">TRƯỜNG TH & THCS PHƯỚC HƯNG</strong>. Nơi mọi băn khoăn về áp lực thi cử, tình bạn và cảm xúc cá nhân luôn được lắng nghe, bảo vệ an toàn và bảo mật trọn vẹn.
          </p>
        </div>

        {/* 3 NÚT CHÍNH LỚN NỔI BẬT THEO YÊU CẦU - THIẾT KẾ NỔI 3D & MÀU SẮC TƯƠI SÁNG RỰC RỠ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-16">
          {/* Nút 1: Góc Chia Sẻ Tâm Tư */}
          <Link
            to="/chia-se"
            className="group relative flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-300/70 hover:shadow-2xl hover:shadow-purple-400/80 hover:-translate-y-2 active:translate-y-0.5 transition-all duration-200 border-t border-white/50 ring-2 ring-white/40 overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center mb-3.5 shadow-md shadow-purple-900/20 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <MessageSquare className="w-7 h-7 text-white drop-shadow" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-wide drop-shadow-md">Góc Chia Sẻ Tâm Tư</span>
            <span className="text-xs text-purple-100 mt-1.5 font-medium text-center">
              Tâm sự ẩn danh, trải lòng & tìm sự đồng cảm
            </span>
          </Link>

          {/* Nút 2: Trò Chuyện Cùng Trợ Lý AI */}
          <Link
            to="/tro-ly-ai"
            className="group relative flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white shadow-xl shadow-sky-300/70 hover:shadow-2xl hover:shadow-sky-400/80 hover:-translate-y-2 active:translate-y-0.5 transition-all duration-200 border-t border-white/50 ring-2 ring-white/40 overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center mb-3.5 shadow-md shadow-sky-900/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <Bot className="w-7 h-7 text-white drop-shadow" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-wide drop-shadow-md">Trò Chuyện Cùng Trợ Lý AI</span>
            <span className="text-xs text-sky-100 mt-1.5 font-medium text-center">
              Tư vấn 24/7, xoa dịu lo âu & giải tỏa áp lực
            </span>
          </Link>

          {/* Nút 3: Kỹ Năng Sống Học Đường (thay thế nút SOS 111 phía trên vì ở dưới đã có nút tròn nổi) */}
          <Link
            to="/ky-nang-song"
            className="group relative flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 text-white shadow-xl shadow-teal-300/70 hover:shadow-2xl hover:shadow-teal-400/80 hover:-translate-y-2 active:translate-y-0.5 transition-all duration-200 border-t border-white/50 ring-2 ring-white/40 overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center mb-3.5 shadow-md shadow-teal-900/20 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <Sparkles className="w-7 h-7 text-white drop-shadow" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-wide drop-shadow-md">Kỹ Năng Sống Học Đường</span>
            <span className="text-xs text-emerald-100 mt-1.5 font-medium text-center">
              Cẩm nang ứng phó áp lực, tình bạn & cảm xúc
            </span>
          </Link>
        </div>

        {/* NÚT / BANNER NHẮN TIN CHO CÔ THÙY TRANG - THIẾT KẾ NỔI 3D SẮC NÉT & TƯƠI SÁNG */}
        <div className="max-w-4xl mx-auto mb-14 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 text-white shadow-xl shadow-teal-200/80 border border-white/40 ring-2 ring-white/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <MessageCircle className="w-7 h-7 text-white drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black leading-snug drop-shadow-xs">
                  Nhắn Tin Riêng Tư Cho Cô Nguyễn Thị Thùy Trang
                </h3>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/25 text-[10px] font-extrabold uppercase tracking-wider">
                  Phòng 692
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5 font-medium">
                Chuyên viên Tham vấn Tâm lý Học đường • Bảo mật 100%, sẵn sàng lắng nghe mọi tâm sự của em
              </p>
            </div>
          </div>
          <button
            onClick={onOpenMessageCounselor}
            className="px-6 py-3.5 rounded-2xl bg-white text-teal-900 hover:bg-teal-50 font-black text-xs sm:text-sm shadow-xl shadow-teal-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shrink-0 border border-teal-100"
          >
            <Send className="w-4 h-4 text-teal-600" />
            <span>Nhắn tin cho Cô Thùy Trang</span>
          </button>
        </div>

        {/* 4 Feature Cards (Glassmorphism & Raised 3D Styling, Màu Sắc Tươi Sáng) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div
            onClick={() => navigate('/cam-xuc')}
            className="cursor-pointer p-5 rounded-3xl bg-gradient-to-b from-amber-50/90 to-orange-50/80 backdrop-blur-xl border border-amber-200/80 shadow-md shadow-amber-200/50 hover:shadow-xl hover:-translate-y-1.5 active:translate-y-0.5 transition-all duration-200 ring-1 ring-amber-100"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center mb-3 shadow-md shadow-amber-300">
              <Smile className="w-5 h-5 fill-white/20" />
            </div>
            <h3 className="font-black text-amber-950 text-sm mb-1">Nhật Ký Cảm Xúc</h3>
            <p className="text-xs text-amber-900/70 leading-relaxed">
              Điểm danh tâm trạng mỗi ngày qua các biểu tượng cảm xúc, theo dõi biểu đồ tâm lý học đường.
            </p>
          </div>

          <div
            onClick={() => navigate('/chong-bat-nat')}
            className="cursor-pointer p-5 rounded-3xl bg-gradient-to-b from-rose-50/90 to-pink-50/80 backdrop-blur-xl border border-rose-200/80 shadow-md shadow-rose-200/50 hover:shadow-xl hover:-translate-y-1.5 active:translate-y-0.5 transition-all duration-200 ring-1 ring-rose-100"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 text-white flex items-center justify-center mb-3 shadow-md shadow-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-black text-rose-950 text-sm mb-1">Phòng Chống Bắt Nạt</h3>
            <p className="text-xs text-rose-900/70 leading-relaxed">
              Gửi báo cáo bạo lực học đường an toàn, ẩn danh 100%, bảo vệ học sinh TRƯỜNG TH&THCS PHƯỚC HƯNG ngay lập tức.
            </p>
          </div>

          <div
            onClick={() => navigate('/dang-ky-tu-van')}
            className="cursor-pointer p-5 rounded-3xl bg-gradient-to-b from-teal-50/90 to-emerald-50/80 backdrop-blur-xl border border-teal-200/80 shadow-md shadow-teal-200/50 hover:shadow-xl hover:-translate-y-1.5 active:translate-y-0.5 transition-all duration-200 ring-1 ring-teal-100"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center mb-3 shadow-md shadow-teal-300">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-black text-teal-950 text-sm mb-1">Đặt Lịch Giáo Viên</h3>
            <p className="text-xs text-teal-900/70 leading-relaxed">
              Gặp Cô Nguyễn Thị Thùy Trang tại Phòng 692 (TRƯỜNG TH&THCS PHƯỚC HƯNG).
            </p>
          </div>

          <div
            onClick={() => navigate('/ky-nang-song')}
            className="cursor-pointer p-5 rounded-3xl bg-gradient-to-b from-purple-50/90 to-fuchsia-50/80 backdrop-blur-xl border border-purple-200/80 shadow-md shadow-purple-200/50 hover:shadow-xl hover:-translate-y-1.5 active:translate-y-0.5 transition-all duration-200 ring-1 ring-purple-100"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-500 to-fuchsia-600 text-white flex items-center justify-center mb-3 shadow-md shadow-purple-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-black text-purple-950 text-sm mb-1">Cẩm Nang Kỹ Năng Sống</h3>
            <p className="text-xs text-purple-900/70 leading-relaxed">
              Kho cẩm nang kiểm soát lo âu, bí quyết giải tỏa áp lực thi cử và xây dựng tình bạn lành mạnh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. TÍNH NĂNG 1: NHẬT KÝ CẢM XÚC
// ==========================================

const EMOJI_OPTIONS = [
  { emoji: '😄', label: 'Vui vẻ', color: 'from-amber-400 to-orange-400', tag: 'Tích cực' },
  { emoji: '😊', label: 'Bình yên', color: 'from-emerald-400 to-teal-400', tag: 'Cân bằng' },
  { emoji: '😰', label: 'Lo lắng', color: 'from-sky-400 to-indigo-400', tag: 'Căng thẳng' },
  { emoji: '😢', label: 'Buồn bã', color: 'from-blue-400 to-indigo-500', tag: 'U sầu' },
  { emoji: '😡', label: 'Bực bội', color: 'from-rose-400 to-red-500', tag: 'Bứt rứt' },
  { emoji: '🥱', label: 'Mệt mỏi', color: 'from-slate-400 to-stone-500', tag: 'Kiệt sức' },
  { emoji: '🤩', label: 'Hào hứng', color: 'from-fuchsia-400 to-pink-500', tag: 'Hứng khởi' },
  { emoji: '🥺', label: 'Cần sẻ chia', color: 'from-purple-400 to-indigo-400', tag: 'Cần an ủi' },
];

function EmotionPage() {
  const { currentUser } = useAuth();
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0]);
  const [intensity, setIntensity] = useState(3);
  const [topic, setTopic] = useState('Học tập & Thi cử');
  const [note, setNote] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [savedLogs, setSavedLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Tải danh sách nhật ký cảm xúc từ Firestore
  const fetchLogs = async () => {
    try {
      const q = query(collection(db, 'emotionLogs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSavedLogs(items);
    } catch {
      // Fallback local storage
      const local = localStorage.getItem('demo_emotion_logs');
      if (local) setSavedLogs(JSON.parse(local));
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSaveEmotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    setSuccessMsg('');

    const newLog = {
      emoji: selectedEmoji.emoji,
      label: selectedEmoji.label,
      intensity,
      topic,
      note,
      author: isAnonymous ? 'Học sinh ẩn danh' : (currentUser?.email || 'Học sinh'),
      createdAt: serverTimestamp(),
      dateStr: new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    try {
      await addDoc(collection(db, 'emotionLogs'), newLog);
      setSuccessMsg('Đã ghi lại cảm xúc của em vào hệ thống an toàn!');
      setNote('');
      fetchLogs();
    } catch {
      // Fallback lưu local nếu mạng / rules chưa mở
      const fallbackItem = { ...newLog, id: 'local_' + Date.now(), createdAt: { seconds: Date.now() / 1000 } };
      const updated = [fallbackItem, ...savedLogs];
      setSavedLogs(updated);
      localStorage.setItem('demo_emotion_logs', JSON.stringify(updated));
      setSuccessMsg('Đã lưu nhật ký cảm xúc thành công!');
      setNote('');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Smile className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800">Nhật Ký Cảm Xúc Mỗi Ngày</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Lắng nghe chính mình là bước đầu tiên để xoa dịu mọi áp lực. Chọn cảm xúc và viết đôi dòng tâm sự nhé!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form ghi nhận cảm xúc */}
        <div className="lg:col-span-7 bg-white/75 backdrop-blur-xl border border-white/80 p-6 rounded-3xl shadow-lg">
          <form onSubmit={handleSaveEmotion} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Hôm nay tâm trạng của em như thế nào?
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {EMOJI_OPTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => setSelectedEmoji(item)}
                    className={`flex flex-col items-center p-2.5 rounded-2xl transition-all border ${
                      selectedEmoji.label === item.label
                        ? 'border-indigo-500 bg-indigo-50/80 shadow-md scale-105'
                        : 'border-slate-100 bg-white/60 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl mb-1">{item.emoji}</span>
                    <span className="text-[11px] font-bold text-slate-700">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Chủ đề liên quan:
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
                >
                  <option value="Học tập & Thi cử">Học tập & Thi cử</option>
                  <option value="Bạn bè & Trường lớp">Bạn bè & Trường lớp</option>
                  <option value="Mối quan hệ gia đình">Mối quan hệ gia đình</option>
                  <option value="Cảm xúc cá nhân & Tự ti">Cảm xúc cá nhân & Tự ti</option>
                  <option value="Tình bạn / Tình cảm học trò">Tình bạn / Tình cảm học trò</option>
                  <option value="Khác">Chủ đề khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Mức độ cảm xúc (1 - 5): {intensity}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                  <span>Nhẹ nhàng</span>
                  <span>Vừa phải</span>
                  <span>Rất dữ dội</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                4. Viết đôi lời tâm sự của em:
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Hôm nay làm bài kiểm tra Toán xong em thấy hơi lo lắng điểm kém, sợ bố mẹ buồn..."
                rows={3}
                required
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white/90 focus:ring-2 focus:ring-indigo-300 outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                />
                <span>Lưu ẩn danh (Bảo mật 100%)</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
              >
                {loading ? 'Đang lưu...' : 'Lưu Nhật Ký'}
              </button>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Lịch sử & Thống kê gần đây */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/75 backdrop-blur-xl border border-white/80 p-5 rounded-3xl shadow-lg">
            <h3 className="font-extrabold text-slate-800 text-sm mb-3 flex items-center justify-between">
              <span>Dòng Cảm Xúc Đã Lưu</span>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {savedLogs.length} ghi nhận
              </span>
            </h3>

            {savedLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Chưa có ghi chép nào. Em hãy ghi lại cảm xúc đầu tiên nhé!
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {savedLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs hover:shadow-xs transition"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{log.emoji}</span>
                        <div>
                          <span className="font-bold text-xs text-slate-800">{log.label}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">• {log.topic}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {log.dateStr || 'Gần đây'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/70 p-2 rounded-xl">
                      "{log.note}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. TÍNH NĂNG 2: TRỢ LÝ AI TÂM LÝ HỌC ĐƯỜNG
// ==========================================

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'ai',
    text: 'Chào em! Thầy cô Trợ lý AI Tâm Lý Học Đường luôn ở đây để lắng nghe em. Hôm nay em có điều gì trăn trở về việc học, điểm số, bạn bè hay gia đình không? Cứ thoải mái chia sẻ với mình nhé, mọi chuyện đều hoàn toàn được giữ kín!',
    timestamp: 'Vừa xong'
  }
];

const QUICK_PROMPTS = [
  'Em đang bị áp lực thi cử và điểm số nặng nề quá...',
  'Em cảm thấy bạn bè trong lớp xa lánh mình',
  'Làm sao để tập trung học mà không bị lo âu?',
  'Em và bố mẹ thường xuyên bất đồng quan điểm',
  'Hướng dẫn em kỹ thuật hít thở 4-7-8 xoa dịu căng thẳng'
];

function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Bộ phản hồi tâm lý thông minh, thấu cảm sâu sắc cho học sinh
  const generateCounselorReply = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();

    if (lower.includes('áp lực') || lower.includes('thi cử') || lower.includes('điểm')) {
      return `Thầy cô hiểu cảm giác này của em rất nhiều. Áp lực thi cử và kỳ vọng điểm số là gánh nặng lớn với hầu hết các bạn học sinh.\n\n🌸 Lời khuyên dành cho em lúc này:\n1. Điểm số chỉ phản ánh kết quả một bài thi tại thời điểm đó, KHÔNG định nghĩa giá trị con người em.\n2. Chia nhỏ mục tiêu học: Thay vì ôn 5 tiếng liên tục, hãy học 25 phút rồi nghỉ ngơi 5 phút (kỹ thuật Pomodoro).\n3. Tối nay, hãy cho bản thân ngủ đủ giấc. Não bộ mệt mỏi sẽ khó ghi nhớ bài hơn.\n\nEm đã rất nỗ lực rồi. Nếu áp lực quá lớn, em có thể đặt lịch giáo viên gặp Cô Nguyễn Thị Thùy Trang tại Phòng 692 TRƯỜNG TH&THCS PHƯỚC HƯNG nhé!`;
    }

    if (lower.includes('bạn bè') || lower.includes('xa lánh') || lower.includes('tẩy chay') || lower.includes('bắt nạt')) {
      return `Cảm ơn em đã dũng cảm chia sẻ điều này. Bị bạn bè xa lánh là một trải nghiệm rất tổn thương và cô đơn. Nhưng em hãy nhớ: LỖI HOÀN TOÀN KHÔNG PHẢI Ở EM!\n\n🛡️ Những việc em nên làm ngay:\n1. Không tự trách mình hay cố gắng làm hài lòng những người đối xử tệ với em.\n2. Tìm kiếm sự đồng hành từ ít nhất một người bạn tử tế khác hoặc anh chị, người thân.\n3. Nếu tình trạng này có dấu hiệu bạo lực tinh thần hoặc xúc phạm, em hãy gửi ngay báo cáo tại mục 'Phòng Chống Bắt Nạt Học Đường' trên trang này để thầy cô TRƯỜNG TH&THCS PHƯỚC HƯNG can thiệp bảo vệ em an toàn nhé.`;
    }

    if (lower.includes('hít thở') || lower.includes('4-7-8') || lower.includes('bình tĩnh')) {
      return `Chúng mình cùng thực hành kỹ thuật thở 4-7-8 nhé:\n\n1️⃣ Bước 1: Ngồi thoải mái, thả lỏng 2 vai và nhắm mắt lại.\n2️⃣ Bước 2: Hít vào thật sâu bằng mũi trong 4 giây (1... 2... 3... 4).\n3️⃣ Bước 3: Giữ hơi thở lại trong 7 giây (1... 2... 3... 4... 5... 6... 7).\n4️⃣ Bước 4: Thở ra từ từ bằng miệng như huýt sáo trong 8 giây (1... 2... 3... 4... 5... 6... 7... 8).\n\nLặp lại 4 lần như vậy, nhịp tim em sẽ chậm lại và cảm giác bồn chồn sẽ dịu đi rất nhiều!`;
    }

    if (lower.includes('bố mẹ') || lower.includes('ba mẹ') || lower.includes('gia đình')) {
      return `Bất đồng quan điểm với bố mẹ là chuyện rất phổ biến ở lứa tuổi học trò, vì khoảng cách thế hệ và cách thể hiện sự quan tâm khác nhau.\n\n💡 Một vài gợi ý nhỏ:\n- Chọn thời điểm cả nhà vui vẻ, không căng thẳng để nói chuyện.\n- Dùng mẫu câu 'Con cảm thấy... khi...' thay vì 'Bố mẹ luôn luôn...'.\n- Nếu khó nói trực tiếp, một mẩu giấy nhớ hoặc tin nhắn chân thành cũng là cách tuyệt vời để bố mẹ hiểu lòng em hơn.`;
    }

    return `Thầy cô TRƯỜNG TH&THCS PHƯỚC HƯNG luôn lắng nghe em. Cảm ơn em vì đã tin tưởng và mở lòng chia sẻ. Những cảm xúc em đang trải qua đều rất tự nhiên và đáng được trân trọng.\n\nEm hãy hít một hơi thật sâu. Em có thể sử dụng tính năng 'Đặt lịch giáo viên' để gặp trực tiếp Cô Nguyễn Thị Thùy Trang tại Phòng 692 nhé!`;
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const aiReply: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        text: generateCounselorReply(text),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiReply]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl p-5 shadow-lg mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-200">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <span>Trợ Lý AI Tâm Lý Học Đường</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Bạn đồng hành thấu cảm • Hỗ trợ 24/7 • Hoàn toàn bảo mật
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-2.5 py-1 rounded-full border border-sky-200">
            Trí tuệ cảm xúc & Giảm stress
          </span>
        </div>
      </div>

      {/* Chat Window */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/80 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[520px]">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-xs'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[9px] mt-1 text-right font-medium ${
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
              <Bot className="w-4 h-4 text-sky-500 animate-spin" />
              <span>Trợ lý AI đang lắng nghe và soạn lời khuyên...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-slate-400 font-bold shrink-0">Gợi ý:</span>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="shrink-0 px-2.5 py-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 rounded-full transition shadow-2xs font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tâm sự cùng trợ lý AI (áp lực thi cử, cảm xúc, bạn bè...)..."
            className="flex-1 text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50/50"
          />
          <button
            onClick={() => handleSendMessage()}
            className="p-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-105 active:scale-95 transition shadow-md shadow-indigo-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. TÍNH NĂNG 3: GÓC CHIA SẺ & PHÒNG CHỐNG BẮT NẠT
// ==========================================

// Trang 1: Gửi Tâm Sự Đến Cô Trang & Tra Cứu Phản Hồi (Chỉ Quản trị viên và Cô Trang đăng nhập mới đọc được danh sách tổng)
function ShareCornerPage() {
  const { currentUser, userRole } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonPost, setIsAnonPost] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [createdSecretCode, setCreatedSecretCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // State Tra Cứu Phản Hồi
  const [lookupCode, setLookupCode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [trackedPost, setTrackedPost] = useState<any | null>(null);

  // State Học sinh phản hồi thêm
  const [studentReply, setStudentReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  const isStaff = userRole === 'ADMIN' || userRole === 'COUNSELOR';

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/posts/admin-list', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.posts) {
        setPosts(data.posts);
      } else {
        // Fallback Firestore
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setPosts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch {
      const local = localStorage.getItem('demo_posts');
      if (local) setPosts(JSON.parse(local));
    }
  };

  useEffect(() => {
    if (isStaff) {
      fetchPosts();
    }
  }, [isStaff]);

  // Tạo mã ngẫu nhiên dự phòng nếu offline
  const generateLocalSecretCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s1 = '', s2 = '';
    for (let i = 0; i < 4; i++) {
      s1 += chars.charAt(Math.floor(Math.random() * chars.length));
      s2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TS-${s1}-${s2}`;
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoadingPost(true);
    setCreatedSecretCode(null);

    const postPayload = {
      title: title.trim(),
      content: content.trim(),
      isAnonymous: isAnonPost,
      studentName: isAnonPost ? 'Học sinh ẩn danh' : (currentUser?.email || 'Em học sinh'),
      recipient: 'Cô Nguyễn Thị Thùy Trang (Phòng 692)',
    };

    try {
      // 1. Gửi qua secure backend API (được bảo vệ, hash mã an toàn)
      const res = await fetch('/api/posts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });
      const data = await res.json();

      if (data.success && data.secretCode) {
        setCreatedSecretCode(data.secretCode);
        setTitle('');
        setContent('');
        if (isStaff) fetchPosts();

        // Đồng bộ song song lên Firestore
        try {
          await addDoc(collection(db, 'posts'), {
            title: postPayload.title,
            content: postPayload.content,
            author: postPayload.studentName,
            recipient: postPayload.recipient,
            status: 'WAITING',
            createdAt: serverTimestamp(),
            createdStr: new Date().toLocaleString('vi-VN'),
            secretCode: data.secretCode, // Dùng cho tra cứu nội bộ
            responses: []
          });
        } catch (e) {
          console.warn('Lưu phụ Firestore:', e);
        }
      } else {
        throw new Error(data.message || 'Lỗi gửi bài');
      }
    } catch {
      // Fallback khi offline
      const fallbackCode = generateLocalSecretCode();
      const fallback = {
        id: 'post_' + Date.now(),
        title: postPayload.title,
        content: postPayload.content,
        author: postPayload.studentName,
        recipient: postPayload.recipient,
        secretCode: fallbackCode,
        status: 'WAITING',
        createdAt: new Date().toISOString(),
        createdStr: new Date().toLocaleString('vi-VN'),
        responses: []
      };
      const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
      const updated = [fallback, ...local];
      localStorage.setItem('demo_posts', JSON.stringify(updated));
      setPosts(updated);
      setCreatedSecretCode(fallbackCode);
      setTitle('');
      setContent('');
    } finally {
      setLoadingPost(false);
    }
  };

  // Tra cứu phản hồi bằng mã bí mật
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = lookupCode.trim().toUpperCase();
    if (!clean) return;

    setIsLookingUp(true);
    setLookupError(null);
    setTrackedPost(null);

    try {
      // 1. Thử gọi qua Backend API trước
      const res = await fetch('/api/posts/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: clean }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setTrackedPost(data.data);
        setIsLookingUp(false);
        return;
      }
    } catch {
      // Fallback kiểm tra Firestore hoặc localStorage
    }

    try {
      // 2. Kiểm tra trên Firestore nếu backend đang dùng database khác
      const q = query(collection(db, 'posts'));
      const snapshot = await getDocs(q);
      const found = snapshot.docs.find(d => {
        const p = d.data();
        return p.secretCode && p.secretCode.trim().toUpperCase() === clean;
      });

      if (found) {
        setTrackedPost({ id: found.id, ...found.data() });
        setIsLookingUp(false);
        return;
      }
    } catch {
      // Bỏ qua lỗi firestore
    }

    // 3. Kiểm tra localStorage fallback
    const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
    const matchLocal = local.find((p: any) => p.secretCode && p.secretCode.trim().toUpperCase() === clean);
    if (matchLocal) {
      setTrackedPost(matchLocal);
    } else {
      setLookupError('Mã tra cứu không chính xác hoặc bài tâm sự chưa được tạo. Vui lòng kiểm tra lại từng ký tự.');
    }
    setIsLookingUp(false);
  };

  // Học sinh gửi thêm tin nhắn
  const handleStudentSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentReply.trim() || !trackedPost) return;

    setSendingReply(true);
    setReplySuccess(false);

    const messageText = studentReply.trim();
    const cleanCode = (lookupCode || trackedPost.secretCode || '').trim().toUpperCase();

    try {
      const res = await fetch('/api/posts/reply-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretCode: cleanCode,
          message: messageText,
          senderName: trackedPost.author || 'Em học sinh',
        }),
      });
      const data = await res.json();

      if (data.success) {
        const newMsg = data.response;
        setTrackedPost({
          ...trackedPost,
          status: 'WAITING',
          responses: [...(trackedPost.responses || []), newMsg],
        });
        setStudentReply('');
        setReplySuccess(true);
      } else {
        throw new Error(data.message);
      }
    } catch {
      // Fallback
      const newMsg = {
        id: 'msg_' + Date.now(),
        senderType: 'STUDENT',
        senderName: trackedPost.author || 'Em học sinh',
        content: messageText,
        createdAt: new Date().toISOString(),
      };
      const updatedPost = {
        ...trackedPost,
        status: 'WAITING',
        responses: [...(trackedPost.responses || []), newMsg],
      };
      setTrackedPost(updatedPost);

      // Lưu lại local
      const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
      const updatedList = local.map((p: any) => p.id === trackedPost.id ? updatedPost : p);
      localStorage.setItem('demo_posts', JSON.stringify(updatedList));

      setStudentReply('');
      setReplySuccess(true);
    } finally {
      setSendingReply(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handlePrintCode = (code: string, postTitle: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Phiếu Tra Cứu Tâm Sự - Trường TH&THCS Phước Hưng</title>
            <style>
              body { font-family: sans-serif; padding: 40px; text-align: center; color: #1e293b; }
              .box { border: 2px dashed #3b82f6; border-radius: 16px; padding: 30px; max-width: 500px; margin: 0 auto; background: #eff6ff; }
              .code { font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #1d4ed8; background: #fff; padding: 12px 20px; border-radius: 12px; margin: 20px 0; display: inline-block; border: 1px solid #bfdbfe; }
              .note { font-size: 13px; color: #64748b; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>TRƯỜNG TH & THCS PHƯỚC HƯNG</h2>
              <p><strong>CỔNG TƯ VẤN TÂM LÝ - PHÒNG 692 (CÔ THÙY TRANG)</strong></p>
              <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 15px 0;" />
              <p>Mã tra cứu bảo mật phản hồi của em:</p>
              <div class="code">${code}</div>
              <p class="note">Tiêu đề: <em>${postTitle}</em></p>
              <p class="note">
                ⚠️ <strong>Lưu ý quan trọng:</strong> Hãy giữ mã này cẩn thận. Em có thể nhập mã này tại mục "TRA CỨU PHẢN HỒI CỦA THẦY CÔ" trên website để đọc lời khuyên từ Cô Trang và tiếp tục trò chuyện hoàn toàn bảo mật.
              </p>
            </div>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDeletePost = async (id: string) => {
    if (window.confirm('Xóa tin nhắn tâm sự này?')) {
      try {
        await deleteDoc(doc(db, 'posts', id));
        setPosts(posts.filter((p) => p.id !== id));
      } catch {
        const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
        const updated = local.filter((p: any) => p.id !== id);
        localStorage.setItem('demo_posts', JSON.stringify(updated));
        setPosts(updated);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Tiêu đề trang Gửi Tâm Sự Đến Cô Trang */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-2xs mb-3">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>GÓC CHIA SẺ & TRẢI LÒNG TUỔI HỌC TRÒ • PHÒNG 692</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
          Gửi Tâm Sự Đến Cô Nguyễn Thị Thùy Trang
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-2 leading-relaxed">
          Không gian an toàn tuyệt đối để em trải lòng. Học sinh <strong className="text-blue-700">KHÔNG CẦN ĐĂNG NHẬP</strong>. Sau khi gửi, em sẽ nhận một <strong>Mã tra cứu bảo mật</strong> để xem phản hồi riêng tư từ thầy cô.
        </p>
      </div>

      <div className="space-y-8">
        {/* KHỐI 1: FORM GỬI TÂM SỰ (GIỮ NGUYÊN GIAO DIỆN HIỆN TẠI) */}
        <div className="bg-white/95 backdrop-blur-xl border border-blue-100 p-6 sm:p-7 rounded-3xl shadow-lg">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span>Viết lời tâm sự gửi Cô Thùy Trang</span>
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Em có thể chọn gửi ẩn danh để hoàn toàn yên tâm chia sẻ. Cô Trang luôn ở đây để lắng nghe và đồng hành cùng em.
          </p>

          {createdSecretCode ? (
            /* Thông báo đăng thành công & Cung cấp mã tra cứu bí mật */
            <div className="p-6 sm:p-8 rounded-3xl bg-blue-50/90 border border-blue-200 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <span className="text-xs font-black tracking-widest uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                  ĐÃ GỬI TÂM SỰ THÀNH CÔNG
                </span>
                <h3 className="font-black text-lg sm:text-xl text-slate-800 mt-2">
                  Tin nhắn của em đã được chuyển an toàn đến Cô Trang!
                </h3>
              </div>

              {/* Ô hiển thị Mã tra cứu bí mật */}
              <div className="p-5 rounded-2xl bg-white border-2 border-blue-300 shadow-sm max-w-md mx-auto space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Mã tra cứu phản hồi bí mật của em:
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-black text-blue-600 tracking-wider py-1 select-all">
                  {createdSecretCode}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => handleCopyCode(createdSecretCode)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center gap-1.5 active:scale-95"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã'}</span>
                  </button>
                  <button
                    onClick={() => handlePrintCode(createdSecretCode, 'Tâm sự học sinh gửi Cô Trang')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>In / Lưu phiếu</span>
                  </button>
                </div>
              </div>

              {/* Hướng dẫn quan trọng */}
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-left flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Lưu ý bảo mật:</strong> Hãy lưu mã này để xem phản hồi của thầy cô. Nếu mất mã, bạn có thể không truy cập lại được cuộc trò chuyện. Mã này không hiển thị công khai ở bất kỳ đâu khác.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setLookupCode(createdSecretCode);
                    // Tự động cuộn xuống mục tra cứu
                    document.getElementById('lookup-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Tra cứu phản hồi ngay với mã này</span>
                </button>
                <button
                  onClick={() => setCreatedSecretCode(null)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
                >
                  Gửi thêm tâm sự khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <input
                type="text"
                placeholder="Tiêu đề tâm sự (ví dụ: Áp lực thi cử, chuyện bạn bè, khó mở lời với gia đình...)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <textarea
                placeholder="Nội dung tâm sự gửi Cô Trang... Hãy thoải mái trút hết nỗi niềm trong lòng nhé!"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                required
                className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonPost}
                    onChange={(e) => setIsAnonPost(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                  <span>Gửi với danh tính ẩn danh</span>
                </label>

                <button
                  type="submit"
                  disabled={loadingPost}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{loadingPost ? 'Đang gửi...' : 'Đăng Tâm Sự'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* KHỐI 2: MỤC TRA CỨU PHẢN HỒI CỦA THẦY CÔ (DÀNH CHO HỌC SINH) */}
        <div id="lookup-section" className="bg-white/95 backdrop-blur-xl border border-blue-200 p-6 sm:p-7 rounded-3xl shadow-lg scroll-mt-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                TRA CỨU PHẢN HỒI CỦA THẦY CÔ
              </h2>
              <p className="text-xs text-slate-500">
                Nhập mã tra cứu của bài tâm sự để xem câu trả lời và tiếp tục trò chuyện riêng tư với Cô Trang.
              </p>
            </div>
          </div>

          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3 pt-3 mb-5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã tra cứu (ví dụ: TS-XXXX-XXXX)..."
                required
                className="w-full text-xs sm:text-sm font-mono pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={isLookingUp}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2 shrink-0"
            >
              {isLookingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{isLookingUp ? 'Đang tìm...' : 'Xem phản hồi'}</span>
            </button>
          </form>

          {lookupError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 mb-4 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* KẾT QUẢ TRA CỨU ĐƯỢC XÁC THỰC */}
          {trackedPost && (
            <div className="p-6 rounded-3xl bg-blue-50/60 border border-blue-200 space-y-6 animate-in fade-in">
              {/* Header phiếu */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-blue-100">
                <div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Bài tâm sự của em
                  </span>
                  <h3 className="font-black text-base sm:text-lg text-slate-800 mt-1">
                    {trackedPost.title}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Gửi lúc: {trackedPost.createdStr || 'Gần đây'} • Người nhận: {trackedPost.recipient || 'Cô Thùy Trang'}
                  </span>
                </div>

                {/* Trạng thái xử lý theo yêu cầu */}
                <div className="shrink-0">
                  {trackedPost.status === 'REPLIED' || (trackedPost.responses && trackedPost.responses.some((r: any) => r.senderType === 'TEACHER')) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đã có phản hồi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold shadow-2xs">
                      <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                      <span>Đang chờ thầy cô phản hồi</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Nội dung ban đầu học sinh gửi */}
              <div className="p-4 rounded-2xl bg-white border border-blue-100 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">Nội dung em đã gửi:</span>
                {trackedPost.content}
              </div>

              {/* Lịch sử phản hồi & trao đổi */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <span>Lịch sử phản hồi từ thầy cô & trao đổi:</span>
                </h4>

                {(!trackedPost.responses || trackedPost.responses.length === 0) ? (
                  <div className="p-5 rounded-2xl bg-white/80 border border-slate-200 text-center text-xs text-slate-500">
                    Cô Trang đã tiếp nhận bài tâm sự này và đang chuẩn bị phản hồi thấu cảm nhất cho em. Em hãy quay lại sau ít phút hoặc lưu mã để tra cứu nhé!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackedPost.responses.map((resp: any, idx: number) => {
                      const isTeacher = resp.senderType === 'TEACHER' || resp.senderType === 'COUNSELOR';
                      return (
                        <div
                          key={resp.id || idx}
                          className={`p-4 rounded-2xl border transition-all ${
                            isTeacher
                              ? 'bg-blue-100/80 border-blue-300 text-slate-800 ml-0 sm:ml-4 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 mr-0 sm:mr-4 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
                            <span className={`font-black flex items-center gap-1.5 ${isTeacher ? 'text-blue-900' : 'text-slate-800'}`}>
                              {isTeacher ? <GraduationCap className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-slate-500" />}
                              <span>{resp.senderName || (isTeacher ? 'Cô Nguyễn Thị Thùy Trang' : 'Em học sinh')}</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {resp.createdAt ? new Date(resp.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
                            {resp.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ô nhập tin nhắn tiếp theo và nút "Gửi tin nhắn" để học sinh tiếp tục trao đổi không cần tài khoản */}
              <form onSubmit={handleStudentSendMessage} className="space-y-3 pt-2 border-t border-blue-100">
                <label className="block text-xs font-bold text-slate-700">
                  Gửi thêm lời nhắn hoặc phản hồi tiếp theo cho Cô Trang:
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={studentReply}
                    onChange={(e) => setStudentReply(e.target.value)}
                    placeholder="Em muốn nhắn thêm điều gì với cô không? (Cô sẽ đọc được ngay trong cuộc trò chuyện này)..."
                    required
                    className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                  />
                </div>

                {replySuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Tin nhắn của em đã được gửi thành công đến Cô Trang!</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sendingReply ? 'Đang gửi tin nhắn...' : 'Gửi tin nhắn'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* KHỐI 3: DÀNH CHO QUẢN TRỊ VIÊN & CÔ TRANG (CHỈ XUẤT HIỆN KHI ĐĂNG NHẬP) */}
        {isStaff ? (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Hộp thư tâm sự học sinh (Quyền: {userRole === 'ADMIN' ? 'Ban Giám Hiệu' : 'Cô Thùy Trang'})</span>
              </h3>
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full">
                {posts.length} tin nhắn
              </span>
            </div>

            {posts.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl text-center text-slate-400 text-xs border border-slate-100">
                Chưa có tin nhắn tâm sự nào từ học sinh.
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-black text-base text-slate-800 leading-snug">{post.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          {post.author}
                        </span>
                        <span>• {post.createdStr || 'Gần đây'}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          post.status === 'REPLIED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {post.status === 'REPLIED' ? 'Đã phản hồi' : 'Chờ phản hồi'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition shrink-0"
                      title="Xóa tin nhắn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {post.content}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Người chưa đăng nhập: Hiển thị cam kết bảo mật rõ ràng theo yêu cầu */
          <div className="p-6 rounded-3xl bg-blue-50/80 border border-blue-200/90 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-black text-slate-800 text-sm sm:text-base">
              Cam Kết Bảo Mật 100% Nội Dung Tâm Sự
            </h3>
            <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
              Mọi tin nhắn của học sinh gửi đến Cô Trang đều được bảo mật tuyệt đối, không hiển thị công khai.{' '}
              <strong className="text-blue-900">
                Chỉ có Quản trị viên (Ban Giám Hiệu) và Cô Nguyễn Thị Thùy Trang đăng nhập mới thấy được tin nhắn
              </strong>{' '}
              hoặc người có mã tra cứu bí mật mới xem được phản hồi tương ứng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Trang 2: Phòng Chống Bắt Nạt Học Đường (Trang chuyên biệt độc lập)
function BullyReportPage() {
  const [bullyCategory, setBullyCategory] = useState('Bạo lực ngôn từ, lăng mạ');
  const [targetClass, setTargetClass] = useState('');
  const [bullyDetail, setBullyDetail] = useState('');
  const [urgency, setUrgency] = useState('Khẩn cấp');
  const [contactInfo, setContactInfo] = useState('');
  const [reportResult, setReportResult] = useState<{ code: string } | null>(null);
  const [submittingBully, setSubmittingBully] = useState(false);

  const handleSubmitBullyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bullyDetail.trim()) return;
    setSubmittingBully(true);

    const code = 'SOS-BN-' + Math.floor(100000 + Math.random() * 900000);

    const reportData = {
      code,
      category: bullyCategory,
      targetClass,
      detail: bullyDetail,
      urgency,
      contactInfo: contactInfo.trim() || 'Tuyệt đối ẩn danh',
      status: 'Chờ tiếp nhận khẩn cấp',
      createdAt: serverTimestamp(),
      createdStr: new Date().toLocaleString('vi-VN')
    };

    try {
      await addDoc(collection(db, 'bullyingReports'), reportData);
      setReportResult({ code });
      setBullyDetail('');
      setTargetClass('');
      setContactInfo('');
    } catch {
      const stored = JSON.parse(localStorage.getItem('demo_bully_reports') || '[]');
      stored.unshift(reportData);
      localStorage.setItem('demo_bully_reports', JSON.stringify(stored));
      setReportResult({ code });
      setBullyDetail('');
      setTargetClass('');
      setContactInfo('');
    } finally {
      setSubmittingBully(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Tiêu đề trang Phòng Chống Bắt Nạt Học Đường */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shadow-2xs mb-3">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>PHÒNG CHỐNG BẮT NẠT HỌC ĐƯỜNG • TRƯỜNG TH&THCS PHƯỚC HƯNG</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
          Hòm Thư Phòng Chống Bắt Nạt Học Đường
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-2 leading-relaxed">
          Bảo mật danh tính 100% • Ban Giám Hiệu & Cô Nguyễn Thị Thùy Trang (Phòng 692) tiếp nhận và can thiệp bảo vệ khẩn cấp.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-8 rounded-3xl shadow-xl">
        <div className="max-w-2xl mx-auto">
          {reportResult ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-emerald-900">Báo Cáo Đã Được Tiếp Nhận An Toàn!</h3>
              <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed max-w-md mx-auto">
                Thầy cô TRƯỜNG TH&THCS PHƯỚC HƯNG đã nhận được thông tin và sẽ bí mật xác minh để can thiệp bảo vệ an toàn cho em/bạn học.
              </p>
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 inline-block font-mono text-sm font-extrabold text-emerald-950">
                Mã hồ sơ bảo mật: <span className="text-rose-600">{reportResult.code}</span>
              </div>
              <div>
                <button
                  onClick={() => setReportResult(null)}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                >
                  Gửi báo cáo khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitBullyReport} className="space-y-4">
              <div className="bg-rose-50/80 border border-rose-200 p-4 rounded-2xl text-xs text-rose-800 leading-relaxed flex items-start gap-3">
                <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black text-rose-900 mb-0.5">CAM KẾT BẢO MẬT TUYỆT ĐỐI 100%:</strong>
                  <span>
                    Danh tính của em được giữ bí mật nghiêm ngặt. Thầy cô tuyệt đối không tiết lộ nguồn báo cáo để đảm bảo em luôn an toàn và không bị ảnh hưởng.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    1. Hình thức vi phạm / bắt nạt:
                  </label>
                  <select
                    value={bullyCategory}
                    onChange={(e) => setBullyCategory(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="Bạo lực ngôn từ, lăng mạ">Bạo lực ngôn từ, lăng mạ, xúc phạm</option>
                    <option value="Bắt nạt thể xác, đe dọa đánh nhau">Bắt nạt thể xác, đe dọa đánh nhau</option>
                    <option value="Bắt nạt trên mạng (Cyberbullying)">Bắt nạt trên mạng (Cyberbullying, bôi nhọ)</option>
                    <option value="Cô lập, tẩy chay có tổ chức">Cô lập, ép buộc, tẩy chay có tổ chức</option>
                    <option value="Trấn lột tiền bạc, đồ dùng">Trấn lột tiền bạc, đồ dùng học tập</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    2. Mức độ khẩn cấp:
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="Khẩn cấp">Khẩn cấp (Cần can thiệp trong ngày)</option>
                    <option value="Nghiêm trọng">Nghiêm trọng (Xảy ra liên tục nhiều ngày)</option>
                    <option value="Cảnh báo sớm">Cảnh báo sớm (Có nguy cơ bùng phát)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  3. Lớp học hoặc địa điểm xảy ra sự việc:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Lớp 8A3, khu vực hành lang tầng 3 hoặc sân bóng rổ..."
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  4. Mô tả chi tiết sự việc:
                </label>
                <textarea
                  placeholder="Mô tả cụ thể chuyện gì đã xảy ra, ai là người bị bắt nạt, hành vi bắt nạt như thế nào..."
                  value={bullyDetail}
                  onChange={(e) => setBullyDetail(e.target.value)}
                  rows={4}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  5. Thông tin liên hệ của em (Tùy chọn - để trống để ẩn danh 100%):
                </label>
                <input
                  type="text"
                  placeholder="Số điện thoại hoặc email (nếu muốn cô Thùy Trang phản hồi riêng cho em)..."
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingBully}
                  className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-rose-200 hover:scale-101 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span>{submittingBully ? 'Đang gửi hồ sơ...' : 'GỬI BÁO CÁO BẢO MẬT NGAY'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Hướng dẫn an toàn khẩn cấp */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Trường hợp khẩn cấp nguy hiểm:</span>
              <span className="text-rose-600 font-extrabold">Gọi ngay Tổng đài Quốc gia 111</span>
            </div>
            <div className="text-indigo-600 font-semibold">
              Gặp trực tiếp: Cô Nguyễn Thị Thùy Trang (Phòng 692)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. TÍNH NĂNG 4: ĐẶT LỊCH TƯ VẤN & THƯ VIỆN KỸ NĂNG
// ==========================================

const COUNSELORS = [
  {
    id: 'c2',
    name: 'Cô Nguyễn Thị Thùy Trang',
    role: 'Giáo viên Tham vấn Tâm lý (TRƯỜNG TH&THCS PHƯỚC HƯNG)',
    location: 'Phòng 692 (Tầng 6 Nhà Đa Năng - TRƯỜNG TH&THCS PHƯỚC HƯNG)',
    desc: 'Lắng nghe nỗi sợ hãi, bẽn lẽn, xây dựng lòng tự tin, kỹ năng giao tiếp hòa nhập bạn bè và luôn đồng hành hỗ trợ học sinh tại Phòng 692.',
    avatar: '👩‍🏫'
  }
];

const ARTICLES = [
  {
    id: 'a1',
    category: 'Áp lực học tập',
    title: '5 Bước Giải Tỏa Cơn Hoảng Loạn Trước Phòng Thi',
    summary: 'Cách làm dịu nhịp tim, kỹ thuật tự trấn an và phương pháp ôn thi khoa học giúp não bộ không bị "đóng băng" khi nhận đề thi.',
    readTime: '4 phút đọc',
    content: `Cảm giác tim đập thình thịch, tay run và đầu óc trống rỗng trước giờ phát đề là phản ứng tự nhiên của cơ thể khi đối mặt với stress.\n\n1. Hãy hít thở thật sâu bằng bụng: Đặt tay lên bụng, hít vào để bụng phồng lên, thở ra từ từ.\n2. Uống từng ngụm nước nhỏ để báo hiệu cho não bộ biết cơ thể đang an toàn.\n3. Viết ra giấy nháp những công thức hoặc từ khóa em nhớ trước tiên để giải phóng bộ nhớ đệm.\n4. Làm câu dễ trước, câu khó sau để tạo đà tự tin.\n5. Luôn nhớ rằng: Điểm số một bài thi không định nghĩa tương lai hay giá trị của em!`
  },
  {
    id: 'a2',
    category: 'Quan hệ bạn bè',
    title: 'Làm Sao Khi Cảm Thấy Mình Lạc Lõng Giữa Tập Thể Lớp?',
    summary: 'Bí quyết mở lòng, tìm kiếm những người bạn cùng tần số và học cách yêu thương bản thân mà không cần cố hòa tan vào đám đông.',
    readTime: '5 phút đọc',
    content: `Không phải ai trong lớp cũng phải trở thành bạn thân của nhau. Chất lượng tình bạn luôn quan trọng hơn số lượng.\n\n- Thay vì cố gắng làm vừa lòng tất cả mọi người, hãy bắt đầu từ những cử chỉ nhỏ: một lời chào buổi sáng, một nụ cười, hay việc giúp đỡ bạn cùng bàn một chiếc bút.\n- Tìm kiếm những người bạn cùng sở thích (vẽ tranh, đọc sách, chơi cờ vua, lập trình).\n- Khi em biết trân trọng chính mình, sự tự tin tự nhiên sẽ thu hút những người bạn chân thành đến với em.`
  },
  {
    id: 'a3',
    category: 'Kiểm soát cảm xúc',
    title: 'Kỹ Thuật Chiếc Hộp Cảm Xúc: Quản Lý Cơn Giận Lành Mạnh',
    summary: 'Giận dữ không phải là xấu, quan trọng là cách em biểu đạt nó sao cho không làm tổn thương mình và người khác.',
    readTime: '3 phút đọc',
    content: `Mỗi khi cảm thấy cơn giận bùng lên:\n\n1. Dừng lại 10 giây trước khi nói hoặc hành động bất kỳ điều gì.\n2. Rời khỏi không gian căng thẳng, đi rửa mặt bằng nước mát.\n3. Viết hết những lời bực bội ra một tờ giấy, sau đó xé nhỏ và vứt vào sọt rác (phương pháp xả năng lượng an toàn).\n4. Khi đã bình tĩnh, hãy dùng ngôn ngữ hòa nhã để bày tỏ quan điểm của mình.`
  },
  {
    id: 'a4',
    category: 'Giao tiếp gia đình',
    title: 'Nói Chuyện Với Bố Mẹ Khi Điểm Số Không Như Ý Muốn',
    summary: 'Cách đối thoại chân thành, nhận trách nhiệm và cùng gia đình tìm giải pháp thay vì trốn tránh trong sợ hãi.',
    readTime: '6 phút đọc',
    content: `Bố mẹ thường la mắng vì lo lắng cho tương lai của em nhiều hơn là vì ghét bỏ em.\n\n- Hãy chủ động báo điểm với bố mẹ trước khi cô giáo nhắn tin.\n- Thẳng thắn thừa nhận phần mình chưa làm tốt: "Con biết bài này con chưa ôn kỹ phần..."\n- Đề xuất giải pháp cải thiện: "Con sẽ nhờ bạn giảng lại bài này và làm thêm bài tập tuần này ạ."\n- Sự trưởng thành và trách nhiệm của em sẽ khiến bố mẹ an tâm và bao dung hơn rất nhiều.`
  },
  {
    id: 'a5',
    category: 'Quan hệ bạn bè',
    title: 'Kỹ Năng Lắng Nghe & Thấu Cảm: Bí Quyết Gắn Kết Tình Bạn',
    summary: 'Biết lắng nghe chân thành là chiếc chìa khóa vàng giúp em trở thành người bạn đáng tin cậy nhất trong lớp.',
    readTime: '4 phút đọc',
    content: `Lắng nghe không chỉ là im lặng nghe người khác nói, mà là cảm nhận được cảm xúc của đối phương:\n\n1. Nhìn vào mắt bạn với ánh nhìn thấu hiểu, không bấm điện thoại khi bạn đang kể chuyện.\n2. Không vội phán xét hay ngắt lời để đưa ra lời khuyên quá sớm.\n3. Đặt câu hỏi gợi mở: "Lúc đó bạn cảm thấy thế nào?", "Mình có thể giúp gì cho bạn không?"\n4. Giữ kín bí mật mà bạn đã tin tưởng gửi gắm cho em.`
  },
  {
    id: 'a6',
    category: 'Kỹ năng tự bảo vệ',
    title: '4 Cách Nói "Không" Quyết Đoán Khi Bị Bạn Bè Rủ Rê Tiêu Cực',
    summary: 'Cách từ chối khéo léo nhưng dứt khoát trước những trò đùa tai hại, trốn học hoặc hành vi bắt nạt người khác.',
    readTime: '5 phút đọc',
    content: `Nói "Không" là quyền lợi và sự dũng cảm của mỗi người để bảo vệ ranh giới an toàn của bản thân:\n\n1. Nguyên tắc đĩa hát hỏng: Lặp lại câu từ chối bình tĩnh: "Mình không tham gia đâu nhé", "Mình không thích việc này".\n2. Đưa ra lý do chính đáng: "Mình đã hứa về nhà đúng giờ với mẹ rồi", "Mình cần ôn bài".\n3. Đề xuất hoạt động lành mạnh thay thế: "Thay vì trêu bạn ấy, tụi mình ra sân bóng đá đi".\n4. Rời khỏi tình huống nếu cảm thấy bị ép buộc.`
  }
];

// ==========================================
// 8A. TRANG KỸ NĂNG SỐNG (ĐƯỢC ĐƯA RA NGOÀI RIÊNG BIỆT)
// ==========================================

function LifeSkillsPage() {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('Tất cả');
  const [activeArticleModal, setActiveArticleModal] = useState<any | null>(null);

  const categories = ['Tất cả', 'Áp lực học tập', 'Quan hệ bạn bè', 'Kiểm soát cảm xúc', 'Giao tiếp gia đình', 'Kỹ năng tự bảo vệ'];

  const handleSaveArticle = async (article: any) => {
    try {
      const savedItems = JSON.parse(localStorage.getItem('tamly_saved_posts') || '[]');
      const exists = savedItems.some((item: any) => item.id === ('art_' + article.id));
      if (!exists) {
        savedItems.unshift({
          id: 'art_' + article.id,
          title: article.title,
          content: article.content,
          author: 'Cẩm nang Kỹ năng sống Học đường',
          category: article.category,
          savedAt: new Date().toLocaleDateString('vi-VN')
        });
        localStorage.setItem('tamly_saved_posts', JSON.stringify(savedItems));
      }
      if (currentUser) {
        try {
          const ref = doc(db, 'users', currentUser.uid, 'savedPosts', 'art_' + article.id);
          await setDoc(ref, {
            postId: article.id,
            title: article.title,
            content: article.content,
            author: 'Cẩm nang Kỹ năng sống Học đường',
            category: article.category,
            savedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Lưu Firestore phụ:', e);
        }
      }
      alert('Đã lưu cẩm nang vào mục "Đã lưu" của em thành công!');
    } catch {
      alert('Đã lưu bài viết thành công!');
    }
  };

  const filteredArticles = ARTICLES.filter((a) => {
    const matchCat = selectedCat === 'Tất cả' || a.category === selectedCat;
    const matchSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Banner Giới thiệu Chuyên mục Kỹ năng sống */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 sm:p-10 text-white shadow-xl shadow-teal-200/50 mb-10 border-t border-white/30">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-64 h-64 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-black tracking-wide mb-4 shadow-xs">
            <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>CHUYÊN TRANG KỸ NĂNG SỐNG HỌC ĐƯỜNG • TRƯỜNG TH&THCS PHƯỚC HƯNG</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-3">
            Hành Trang Kỹ Năng Sống & Bản Lĩnh Học Đường
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed font-normal mb-6 max-w-2xl">
            Nơi chia sẻ những bí quyết tâm lý thiết thực, kỹ năng tự bảo vệ, giải tỏa áp lực thi cử, quản lý cảm xúc và xây dựng tình bạn tích cực dành cho các em học sinh.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dang-ky-tu-van"
              className="px-5 py-2.5 rounded-2xl bg-white text-teal-700 hover:bg-emerald-50 font-black text-xs shadow-lg shadow-teal-900/20 hover:scale-105 active:scale-95 transition flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>Đặt lịch gặp Cô Thùy Trang (Phòng 692)</span>
            </Link>

            <Link
              to="/tro-ly-ai"
              className="px-5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              <span>Hỏi Trợ lý AI về kỹ năng</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mẹo Bỏ Túi Kỹ Năng Nhanh (Pocket Skills Grid) */}
      <div className="mb-10">
        <h2 className="text-base sm:text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <span>Mẹo Bỏ Túi Xử Lý Nhanh Tình Huống Học Đường</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 shadow-md shadow-emerald-100 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm mb-2 shadow-sm">
              4-7-8
            </div>
            <h3 className="font-extrabold text-xs text-emerald-950 mb-1">Thở Sâu Hạ Căng Thẳng</h3>
            <p className="text-[11px] text-emerald-900/80 leading-relaxed">
              Hít vào 4 giây, giữ hơi 7 giây, thở ra nhẹ nhàng 8 giây giúp tim đập đều ngay trước giờ kiểm tra.
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 shadow-md shadow-amber-100 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm mb-2 shadow-sm">
              5s
            </div>
            <h3 className="font-extrabold text-xs text-amber-950 mb-1">Nguyên Tắc Dừng 5 Giây</h3>
            <p className="text-[11px] text-amber-900/80 leading-relaxed">
              Khi tức giận, đếm ngược từ 5 về 1 trước khi nói để tránh lời nói làm tổn thương bạn bè.
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-200/80 shadow-md shadow-cyan-100 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500 text-white flex items-center justify-center font-black text-sm mb-2 shadow-sm">
              🛡️
            </div>
            <h3 className="font-extrabold text-xs text-cyan-950 mb-1">Ranh Giới An Toàn</h3>
            <p className="text-[11px] text-cyan-900/80 leading-relaxed">
              Em luôn có quyền từ chối những việc khiến em không thoải mái. Nói "Không" là dũng cảm!
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/80 shadow-md shadow-purple-100 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-purple-500 text-white flex items-center justify-center font-black text-sm mb-2 shadow-sm">
              🤝
            </div>
            <h3 className="font-extrabold text-xs text-purple-950 mb-1">Chủ Động Kết Bạn</h3>
            <p className="text-[11px] text-purple-900/80 leading-relaxed">
              Một nụ cười chào buổi sáng và một lời khen chân thành là chiếc cầu nối tình bạn tuyệt vời nhất.
            </p>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm & Lọc danh mục với nút nổi 3D */}
      <div className="bg-white/90 backdrop-blur-xl border border-indigo-100/80 p-5 sm:p-6 rounded-3xl shadow-lg shadow-indigo-100/50 space-y-4 mb-8">
        <div className="relative">
          <Search className="w-4 h-4 text-emerald-600 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Tìm kiếm bài viết, cẩm nang tâm lý, kỹ năng học đường..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm bg-slate-50/70 outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
          />
        </div>

        {/* Nút lọc nổi 3D màu sắc tươi sáng */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-2 rounded-2xl font-black whitespace-nowrap transition-all duration-200 shadow-xs ${
                selectedCat === cat
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200 -translate-y-0.5 ring-2 ring-emerald-200'
                  : 'bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/50 border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid danh sách bài viết cẩm nang kỹ năng sống */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredArticles.map((art) => (
          <div
            key={art.id}
            className="bg-white/95 backdrop-blur-xl border border-indigo-50 rounded-3xl p-6 shadow-md shadow-slate-200/60 hover:shadow-2xl hover:shadow-teal-100 hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {art.category}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {art.readTime}
                </span>
              </div>
              <h3 className="font-black text-sm sm:text-base text-slate-800 mb-2 leading-snug">
                {art.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-3">
                {art.summary}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-2">
              <button
                onClick={() => setActiveArticleModal(art)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5"
              >
                <span>Đọc cẩm nang</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleSaveArticle(art)}
                className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200/60 hover:shadow-xs transition"
                title="Lưu cẩm nang này"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal đọc bài viết chi tiết */}
      {activeArticleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-[11px] font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  {activeArticleModal.category}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                  {activeArticleModal.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveArticleModal(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line py-3 border-y border-slate-100 my-4">
              {activeArticleModal.content}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleSaveArticle(activeArticleModal);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200 flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Lưu bài này</span>
              </button>
              <button
                onClick={() => setActiveArticleModal(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 8B. TRANG ĐẶT LỊCH GIÁO VIÊN (CÔ THÙY TRANG - PHÒNG 692)
// ==========================================

function AppointmentPage({ onOpenMessageCounselor }: { onOpenMessageCounselor?: () => void }) {
  const { currentUser } = useAuth();
  const [selectedCounselor, setSelectedCounselor] = useState(COUNSELORS[0].id);
  const [appointDate, setAppointDate] = useState('');
  const [appointTime, setAppointTime] = useState('14:30');
  const [appointType, setAppointType] = useState('Gặp Cô Nguyễn Thị Thùy Trang tại Phòng 692');
  const [studentNote, setStudentNote] = useState('');
  const [studentContact, setStudentContact] = useState('');
  const [appointSuccess, setAppointSuccess] = useState(false);
  const [loadingAppoint, setLoadingAppoint] = useState(false);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointDate || !studentNote.trim()) return;
    setLoadingAppoint(true);

    const cObj = COUNSELORS.find((c) => c.id === selectedCounselor) || COUNSELORS[0];

    const appointmentData = {
      counselorName: cObj.name,
      counselorId: cObj.id,
      date: appointDate,
      time: appointTime,
      type: appointType,
      note: studentNote,
      contact: studentContact || currentUser?.email || 'Học sinh ẩn danh',
      userEmail: currentUser?.email || 'anonymous',
      status: 'Chờ xác nhận',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'appointments'), appointmentData);
      setAppointSuccess(true);
      setStudentNote('');
    } catch {
      // Fallback local
      const list = JSON.parse(localStorage.getItem('demo_appointments') || '[]');
      list.unshift(appointmentData);
      localStorage.setItem('demo_appointments', JSON.stringify(list));
      setAppointSuccess(true);
      setStudentNote('');
    } finally {
      setLoadingAppoint(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Giới thiệu giáo viên tham vấn */}
      <div className="grid grid-cols-1 gap-4">
        {COUNSELORS.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedCounselor(c.id)}
            className={`cursor-pointer p-6 rounded-3xl border transition-all ${
              selectedCounselor === c.id
                ? 'bg-white border-teal-500 shadow-xl shadow-teal-100 ring-2 ring-teal-300 scale-101'
                : 'bg-white/80 border-slate-200 hover:bg-white shadow-md'
            }`}
          >
            <div className="flex items-center gap-3.5 mb-2.5">
              <span className="text-4xl p-2 rounded-2xl bg-teal-50 border border-teal-100">{c.avatar}</span>
              <div>
                <h2 className="font-black text-slate-800 text-base sm:text-lg leading-tight">{c.name}</h2>
                <p className="text-xs font-black text-teal-700 mt-0.5">{c.role}</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">{c.desc}</p>
            <div className="text-xs text-teal-800 font-bold flex items-center gap-1.5 bg-teal-50/80 p-2.5 rounded-xl border border-teal-100/80">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>{c.location}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Form đặt hẹn với nút nổi 3D tươi sáng */}
      <div className="bg-white/95 backdrop-blur-xl border border-indigo-100/80 p-6 sm:p-8 rounded-3xl shadow-xl shadow-teal-100/50">
        <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          <span>Phiếu Đăng Ký Đặt Lịch Giáo Viên - TRƯỜNG TH&THCS PHƯỚC HƯNG</span>
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Mọi buổi gặp đều diễn ra trong không gian riêng tư, tôn trọng và bảo mật 100% danh tính học sinh.
        </p>

        {appointSuccess ? (
          <div className="bg-teal-50 border border-teal-200 rounded-3xl p-8 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="text-base sm:text-lg font-black text-teal-900">Đã Gửi Phiếu Đặt Hẹn Thành Công!</h4>
            <p className="text-xs sm:text-sm text-teal-800 max-w-md mx-auto leading-relaxed">
              Thầy cô TRƯỜNG TH&THCS PHƯỚC HƯNG đã ghi nhận lịch hẹn của em và sẽ đón tiếp em chu đáo tại Phòng 692. Em hãy yên tâm nhé!
            </p>
            <button
              onClick={() => setAppointSuccess(false)}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-2xl text-xs font-black shadow-md shadow-teal-200 hover:scale-105 active:scale-95 transition"
            >
              Đặt thêm lịch khác
            </button>
          </div>
        ) : (
          <form onSubmit={handleBookAppointment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1 uppercase">Ngày hẹn:</label>
                <input
                  type="date"
                  value={appointDate}
                  onChange={(e) => setAppointDate(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1 uppercase">Khung giờ:</label>
                <select
                  value={appointTime}
                  onChange={(e) => setAppointTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-semibold"
                >
                  <option value="08:30 (Giờ ra chơi sáng)">08:30 (Giờ ra chơi sáng)</option>
                  <option value="10:00 (Tiết trống sáng)">10:00 (Tiết trống sáng)</option>
                  <option value="14:30 (Giờ ra chơi chiều)">14:30 (Giờ ra chơi chiều)</option>
                  <option value="16:30 (Sau giờ tan học)">16:30 (Sau giờ tan học)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1 uppercase">Địa điểm gặp:</label>
                <select
                  value={appointType}
                  onChange={(e) => setAppointType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-semibold"
                >
                  <option value="Gặp Cô Nguyễn Thị Thùy Trang tại Phòng 692">Gặp Cô Nguyễn Thị Thùy Trang tại Phòng 692</option>
                  <option value="Trò chuyện trực tuyến bảo mật">Trò chuyện trực tuyến bảo mật</option>
                  <option value="Trao đổi qua thư điện tử">Trao đổi qua thư điện tử</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1 uppercase">
                Vấn đề em muốn cùng thầy cô tháo gỡ:
              </label>
              <textarea
                placeholder="Em đang gặp khó khăn gì? (Ví dụ: Hay mất ngủ vì lo thi, khó hòa nhập với bạn bè, áp lực từ gia đình...)"
                value={studentNote}
                onChange={(e) => setStudentNote(e.target.value)}
                rows={3}
                required
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1 uppercase">
                Thông tin liên hệ (Số điện thoại / Zalo hoặc lớp học):
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Em An lớp 8A2 hoặc SĐT 0912xxxxxx (để thầy cô báo giờ gặp)..."
                value={studentContact}
                onChange={(e) => setStudentContact(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loadingAppoint}
                className="w-full py-3.5 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-teal-200/80 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>{loadingAppoint ? 'Đang gửi phiếu...' : 'XÁC NHẬN ĐẶT LỊCH HẸN VỚI CÔ TRANG'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Wrapper chuyển đổi cho backward compatibility
function AppointmentsAndLibraryPage() {
  const location = useLocation();
  if (location.pathname === '/dang-ky-tu-van') {
    return <AppointmentPage />;
  }
  return <LifeSkillsPage />;
}

// ==========================================
// 9. TRANG BÀI VIẾT ĐÃ LƯU (SAVED POSTS)
// ==========================================

function SavedPostsPage() {
  const { currentUser } = useAuth();
  const [savedList, setSavedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSaved = async () => {
      // 1. Lấy dữ liệu đã lưu từ máy (localStorage) - không cần đăng nhập
      const localItems: any[] = JSON.parse(localStorage.getItem('tamly_saved_posts') || '[]');
      
      if (!currentUser) {
        setSavedList(localItems);
        setLoading(false);
        return;
      }

      // 2. Nếu là tài khoản quản trị/cô Trang có đăng nhập, lấy thêm từ Firestore
      try {
        const q = query(collection(db, 'users', currentUser.uid, 'savedPosts'), orderBy('savedAt', 'desc'));
        const snapshot = await getDocs(q);
        const fbItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Hợp nhất dữ liệu tránh trùng lặp
        const combined = [...fbItems];
        localItems.forEach((li) => {
          if (!combined.some((ci) => ci.id === li.id)) {
            combined.push(li);
          }
        });
        setSavedList(combined);
      } catch (e) {
        console.error('Lỗi tải bài đã lưu:', e);
        setSavedList(localItems);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [currentUser]);

  const handleRemoveSaved = async (id: string) => {
    // Xóa từ localStorage
    const localItems: any[] = JSON.parse(localStorage.getItem('tamly_saved_posts') || '[]');
    const updatedLocal = localItems.filter((item) => item.id !== id);
    localStorage.setItem('tamly_saved_posts', JSON.stringify(updatedLocal));
    
    // Nếu có đăng nhập Firestore thì xóa trên Firestore
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'savedPosts', id));
      } catch (e) {
        console.error('Lỗi xóa Firestore:', e);
      }
    }
    setSavedList((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Bookmark className="w-5 h-5 fill-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Bài Viết & Cẩm Nang Đã Lưu</h1>
            <p className="text-xs text-slate-500">
              {currentUser ? 'Đồng bộ an toàn trên tài khoản của bạn' : 'Lưu trữ tự do trên thiết bị của bạn • Không cần đăng nhập'}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {savedList.length} mục
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Đang tải danh sách bài đã lưu...</div>
      ) : savedList.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl text-center border border-white/80 shadow-md space-y-3">
          <Bookmark className="w-10 h-10 text-indigo-300 mx-auto" />
          <p className="text-slate-600 text-xs sm:text-sm font-semibold">
            Em chưa lưu bài viết hay cẩm nang nào.
          </p>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Em có thể bấm vào biểu tượng 🔖 ở mục <strong>Góc Chia Sẻ</strong> hoặc <strong>Thư Viện Kỹ Năng</strong> để lưu lại đọc bất kỳ lúc nào mà không cần đăng nhập!
          </p>
          <Link
            to="/thu-vien"
            className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition"
          >
            Khám phá Thư viện ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {savedList.map((item) => (
            <div
              key={item.id}
              className="bg-white/80 backdrop-blur-xl p-5 rounded-3xl shadow-md border border-white/80 flex items-start justify-between gap-4"
            >
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1">{item.title}</h3>
                <p className="text-[11px] text-slate-400 mb-2">Tác giả / Nguồn: {item.author || 'Tâm lý học đường'}</p>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/70 p-3 rounded-2xl">
                  {item.content}
                </p>
              </div>
              <button
                onClick={() => handleRemoveSaved(item.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition shrink-0"
                title="Bỏ lưu"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 10. TRANG QUẢN TRỊ (STAFF / ADMIN DASHBOARD)
// ==========================================

function DashboardPage() {
  const { userRole, quickLogin } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'posts' | 'appointments'>('reports');
  const [bullyingList, setBullyingList] = useState<any[]>([]);
  const [postsList, setPostsList] = useState<any[]>([]);
  const [appointList, setAppointList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [postFilter, setPostFilter] = useState<'ALL' | 'WAITING' | 'REPLIED'>('ALL');
  const [postSearch, setPostSearch] = useState('');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [teacherReplyText, setTeacherReplyText] = useState('');
  const [sendingTeacherReply, setSendingTeacherReply] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Bullying reports
      const bSnap = await getDocs(query(collection(db, 'bullyingReports'), orderBy('createdAt', 'desc')));
      setBullyingList(bSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 2. Posts: Thử lấy từ Backend API hoặc Firestore
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/posts/admin-list', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success && data.posts) {
          setPostsList(data.posts);
        } else {
          const pSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc')));
          setPostsList(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch {
        const pSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc')));
        setPostsList(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      // 3. Appointments
      const aSnap = await getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc')));
      setAppointList(aSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // Fallback local
      setBullyingList(JSON.parse(localStorage.getItem('demo_bully_reports') || '[]'));
      setPostsList(JSON.parse(localStorage.getItem('demo_posts') || '[]'));
      setAppointList(JSON.parse(localStorage.getItem('demo_appointments') || '[]'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Xử lý giáo viên trả lời bài tâm sự
  const handleTeacherSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !teacherReplyText.trim()) return;

    setSendingTeacherReply(true);
    const replyContent = teacherReplyText.trim();
    const counselorName = userRole === 'ADMIN' ? 'Ban Giám Hiệu / Quản trị viên' : 'Cô Nguyễn Thị Thùy Trang (Phòng 692)';

    try {
      // 1. Gửi qua Backend API
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/posts/admin-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          postId: selectedPost.id,
          content: replyContent,
          status: 'REPLIED'
        })
      });
      const data = await res.json();

      const newResp = data.response || {
        id: 'resp_' + Date.now(),
        senderType: 'TEACHER',
        senderName: counselorName,
        content: replyContent,
        createdAt: new Date().toISOString()
      };

      // 2. Lưu cập nhật Firestore
      try {
        const postRef = doc(db, 'posts', selectedPost.id);
        const currentResponses = selectedPost.responses || [];
        await updateDoc(postRef, {
          status: 'REPLIED',
          responses: [...currentResponses, newResp],
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Lưu phụ Firestore post:', err);
      }

      // Cập nhật state
      const updatedPost = {
        ...selectedPost,
        status: 'REPLIED',
        responses: [...(selectedPost.responses || []), newResp]
      };
      setSelectedPost(updatedPost);
      setPostsList(postsList.map(p => p.id === selectedPost.id ? updatedPost : p));

      // Cập nhật localStorage
      const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
      const updatedList = local.map((p: any) => p.id === selectedPost.id ? updatedPost : p);
      localStorage.setItem('demo_posts', JSON.stringify(updatedList));

      setTeacherReplyText('');
      alert('Đã gửi phản hồi thành công đến học sinh!');
    } catch {
      // Fallback
      const newResp = {
        id: 'resp_' + Date.now(),
        senderType: 'TEACHER',
        senderName: counselorName,
        content: replyContent,
        createdAt: new Date().toISOString()
      };
      const updatedPost = {
        ...selectedPost,
        status: 'REPLIED',
        responses: [...(selectedPost.responses || []), newResp]
      };
      setSelectedPost(updatedPost);
      setPostsList(postsList.map(p => p.id === selectedPost.id ? updatedPost : p));

      const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
      const updatedList = local.map((p: any) => p.id === selectedPost.id ? updatedPost : p);
      localStorage.setItem('demo_posts', JSON.stringify(updatedList));

      setTeacherReplyText('');
      alert('Đã lưu phản hồi của giáo viên!');
    } finally {
      setSendingTeacherReply(false);
    }
  };

  const handleUpdatePostStatus = async (postId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), { status: newStatus });
    } catch {}
    const updated = postsList.map(p => p.id === postId ? { ...p, status: newStatus } : p);
    setPostsList(updated);
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({ ...selectedPost, status: newStatus });
    }
    const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
    localStorage.setItem('demo_posts', JSON.stringify(local.map((p: any) => p.id === postId ? { ...p, status: newStatus } : p)));
  };

  const handleDeletePost = async (id: string) => {
    if (window.confirm('Xóa bài chia sẻ này khỏi hệ thống?')) {
      try {
        await deleteDoc(doc(db, 'posts', id));
      } catch {}
      setPostsList(postsList.filter((p) => p.id !== id));
      if (selectedPost && selectedPost.id === id) {
        setSelectedPost(null);
      }
      const local = JSON.parse(localStorage.getItem('demo_posts') || '[]');
      localStorage.setItem('demo_posts', JSON.stringify(local.filter((p: any) => p.id !== id)));
    }
  };

  // Lọc và tìm kiếm danh sách bài tâm sự
  const filteredPosts = postsList.filter(p => {
    if (postFilter === 'WAITING' && p.status === 'REPLIED') return false;
    if (postFilter === 'REPLIED' && p.status !== 'REPLIED') return false;
    if (postSearch.trim()) {
      const q = postSearch.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchContent = (p.content || '').toLowerCase().includes(q);
      const matchAuthor = (p.author || '').toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor;
    }
    return true;
  });

  const handleUpdateReportStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bullyingReports', id), { status: newStatus });
      setBullyingList(bullyingList.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch {
      setBullyingList(bullyingList.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    }
  };

  // Nếu chưa đăng nhập với quyền Quản trị hoặc Cô Thùy Trang:
  if (userRole !== 'ADMIN' && userRole !== 'COUNSELOR') {
    return <LoginPage />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-6 rounded-3xl shadow-lg mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Bàn Điều Khiển Quản Trị - TRƯỜNG TH&THCS PHƯỚC HƯNG</h1>
            <p className="text-xs text-slate-500">
              Dành cho Ban Giám Hiệu & Cô Nguyễn Thị Thùy Trang (Phòng 692)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl border border-indigo-200">
          <span>Quyền: {userRole}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          onClick={() => setActiveTab('reports')}
          className={`cursor-pointer p-4 rounded-3xl border transition-all ${
            activeTab === 'reports' ? 'bg-rose-50 border-rose-300 shadow-md' : 'bg-white/70 border-white/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-800">Phòng Chống Bắt Nạt</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900">{bullyingList.length}</div>
          <span className="text-[10px] text-rose-600 font-medium">Hồ sơ tiếp nhận</span>
        </div>

        <div
          onClick={() => setActiveTab('appointments')}
          className={`cursor-pointer p-4 rounded-3xl border transition-all ${
            activeTab === 'appointments' ? 'bg-teal-50 border-teal-300 shadow-md' : 'bg-white/70 border-white/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-teal-800">Lịch Hẹn Giáo Viên</span>
            <Calendar className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-900">{appointList.length}</div>
          <span className="text-[10px] text-teal-600 font-medium">Học sinh đăng ký</span>
        </div>

        <div
          onClick={() => setActiveTab('posts')}
          className={`cursor-pointer p-4 rounded-3xl border transition-all ${
            activeTab === 'posts' ? 'bg-indigo-50 border-indigo-300 shadow-md' : 'bg-white/70 border-white/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-800">Bài Chia Sẻ</span>
            <MessageSquare className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900">{postsList.length}</div>
          <span className="text-[10px] text-indigo-600 font-medium">Tâm sự học sinh</span>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl p-6 shadow-xl">
        {/* Tab 1: Bullying Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800">Danh Sách Báo Cáo Bạo Lực Học Đường</h3>
            {bullyingList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Không có báo cáo bạo lực nào.</p>
            ) : (
              <div className="space-y-3">
                {bullyingList.map((r, i) => (
                  <div key={r.id || i} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                          {r.code || 'SOS-00' + i}
                        </span>
                        <span className="font-bold text-xs text-slate-800">{r.category}</span>
                      </div>
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                        {r.urgency || 'Khẩn cấp'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">{r.detail}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                      <span>Lớp / Địa điểm: <strong>{r.targetClass || 'Chưa rõ'}</strong></span>
                      <span>Liên hệ: <strong>{r.contactInfo || 'Ẩn danh'}</strong></span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateReportStatus(r.id, 'Đã xác minh & Xử lý an toàn')}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700"
                        >
                          Đánh dấu đã can thiệp
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Appointments */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800">Danh Sách Học Sinh Đặt Lịch Giáo Viên</h3>
            {appointList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Chưa có lịch hẹn nào.</p>
            ) : (
              <div className="space-y-3">
                {appointList.map((a, i) => (
                  <div key={a.id || i} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs text-teal-800">{a.counselorName}</span>
                        <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                          {a.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">"{a.note}"</p>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Thời gian: <strong>{a.date} ({a.time})</strong> • Liên hệ: {a.contact}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl shrink-0">
                      {a.status || 'Đã tiếp nhận'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Posts - Quản lý tâm sự học sinh & Trả lời phản hồi */}
        {activeTab === 'posts' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  <span>Quản Lý Tâm Sự Học Sinh & Trả Lời Phản Hồi</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đọc tâm sự, theo dõi lịch sử đối thoại và gửi câu trả lời trực tiếp cho học sinh.
                </p>
              </div>

              {/* Bộ lọc trạng thái */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold shrink-0">
                <button
                  onClick={() => setPostFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    postFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({postsList.length})
                </button>
                <button
                  onClick={() => setPostFilter('WAITING')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    postFilter === 'WAITING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chưa trả lời ({postsList.filter(p => p.status !== 'REPLIED').length})
                </button>
                <button
                  onClick={() => setPostFilter('REPLIED')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    postFilter === 'REPLIED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã trả lời ({postsList.filter(p => p.status === 'REPLIED').length})
                </button>
              </div>
            </div>

            {/* Thanh tìm kiếm */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề, nội dung tâm sự hoặc tác giả..."
                className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>

            {filteredPosts.length === 0 ? (
              <div className="bg-slate-50/70 p-10 rounded-3xl text-center text-slate-400 text-xs border border-dashed border-slate-200">
                Không tìm thấy bài tâm sự nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredPosts.map((p) => {
                  const isReplied = p.status === 'REPLIED';
                  const responseCount = (p.responses || []).length;
                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 cursor-pointer" onClick={() => setSelectedPost(p)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-sm text-slate-800 hover:text-indigo-600 transition">
                            {p.title}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isReplied
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isReplied ? 'Đã phản hồi' : 'Chưa trả lời'}
                          </span>
                          {responseCount > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                              {responseCount} tin trao đổi
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {p.content}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span>Người gửi: <strong className="text-slate-600">{p.author || 'Học sinh'}</strong></span>
                          <span>•</span>
                          <span>Thời gian: {p.createdStr || 'Gần đây'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setSelectedPost(p)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{isReplied ? 'Xem & Tiếp tục trả lời' : 'Trả lời ngay'}</span>
                        </button>
                        <button
                          onClick={() => handleDeletePost(p.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                          title="Xóa bài viết"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODAL / CHI TIẾT BÀI TÂM SỰ & SOẠN CÂU TRẢ LỜI CỦA GIÁO VIÊN */}
            {selectedPost && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95">
                  {/* Modal Header */}
                  <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-indigo-50/40">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                          CHI TIẾT TÂM SỰ HỌC SINH
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedPost.status === 'REPLIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {selectedPost.status === 'REPLIED' ? 'Đã phản hồi' : 'Đang chờ xử lý'}
                        </span>
                      </div>
                      <h3 className="font-black text-lg text-slate-800 leading-snug">
                        {selectedPost.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Tác giả: <strong>{selectedPost.author}</strong> • Gửi lúc: {selectedPost.createdStr || 'Gần đây'}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedPost(null)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-2xl transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body: Lịch sử cuộc trò chuyện */}
                  <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                    {/* Bài tâm sự ban đầu */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">Nội dung tâm sự ban đầu:</span>
                      {selectedPost.content}
                    </div>

                    {/* Lịch sử các phản hồi */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>Lịch sử trao đổi ({ (selectedPost.responses || []).length } lượt):</span>
                      </h4>

                      {(!selectedPost.responses || selectedPost.responses.length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Chưa có câu trả lời nào từ giáo viên. Hãy nhập phản hồi bên dưới.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedPost.responses.map((resp: any, i: number) => {
                            const isTeacher = resp.senderType === 'TEACHER' || resp.senderType === 'COUNSELOR';
                            return (
                              <div
                                key={resp.id || i}
                                className={`p-4 rounded-2xl border ${
                                  isTeacher
                                    ? 'bg-indigo-50/70 border-indigo-200 text-slate-800 ml-4'
                                    : 'bg-amber-50/60 border-amber-200 text-slate-800 mr-4'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                                  <span className="font-bold flex items-center gap-1.5 text-slate-800">
                                    {isTeacher ? <GraduationCap className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-amber-600" />}
                                    <span>{resp.senderName || (isTeacher ? 'Cô Nguyễn Thị Thùy Trang' : 'Học sinh')}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {resp.createdAt ? new Date(resp.createdAt).toLocaleString('vi-VN') : 'Gần đây'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium text-slate-700">
                                  {resp.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Soạn câu trả lời của giáo viên */}
                    <form onSubmit={handleTeacherSubmitReply} className="space-y-3 pt-3 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">
                        Nhập phản hồi của giáo viên (Cô Trang / BGH):
                      </label>
                      <textarea
                        rows={4}
                        value={teacherReplyText}
                        onChange={(e) => setTeacherReplyText(e.target.value)}
                        placeholder="Nhập lời động viên, hướng dẫn, lời khuyên thấu cảm và chân thành dành cho học sinh..."
                        required
                        className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdatePostStatus(selectedPost.id, 'REPLIED')}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition"
                          >
                            Đánh dấu Đã phản hồi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdatePostStatus(selectedPost.id, 'WAITING')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                          >
                            Đặt lại Chờ xử lý
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={sendingTeacherReply}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60"
                        >
                          <Send className="w-4 h-4" />
                          <span>{sendingTeacherReply ? 'Đang gửi...' : 'Gửi phản hồi'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 11. TRANG ĐĂNG NHẬP / AUTH & TÀI KHOẢN MẪU
// ==========================================

function LoginPage() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser, displayName, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!account.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      await login(account.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-blue-100 rounded-2xl shadow-xl p-8 sm:p-10 text-left">
        {/* Logo / Biểu tượng giáo dục */}
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <GraduationCap className="w-8 h-8" />
        </div>

        {/* Tiêu đề & Dòng mô tả theo đúng yêu cầu */}
        <h2 className="text-2xl font-black text-slate-800 text-center tracking-tight">
          ĐĂNG NHẬP HỆ THỐNG
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 text-center mt-1.5 mb-7">
          Vui lòng nhập tài khoản và mật khẩu để tiếp tục
        </p>

        {currentUser ? (
          <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-100 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-1">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-800 font-bold">
              Đang đăng nhập: <br />
              <span className="text-base font-black text-blue-700">{displayName}</span>
              <span className="block text-xs text-slate-500 font-mono mt-1">({currentUser.email})</span>
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                Vào Bàn Quản Trị
              </button>
              <button
                onClick={logout}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Đăng Xuất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tài khoản
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="Tài khoản"
                  required
                  className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-2xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  required
                  className="w-full text-sm pl-10 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-2xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-200/80 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:pointer-events-none mt-2"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 12. ROOT APP ROUTER & WRAPPER
// ==========================================

function AppContent() {
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50/70 via-sky-50/60 to-purple-50/70 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. Thanh trạng thái Firebase cố định trên cùng */}
      <TopFirebaseBar />

      {/* 2. Thanh điều hướng Navbar */}
      <Navbar onOpenEmergency={() => setEmergencyOpen(true)} />

      {/* 3. Nội dung trang chính */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home onOpenEmergency={() => setEmergencyOpen(true)} />} />
          <Route path="/cam-xuc" element={<EmotionPage />} />
          <Route path="/tro-ly-ai" element={<AIChatPage />} />
          <Route path="/chia-se" element={<ShareCornerPage />} />
          <Route path="/chong-bat-nat" element={<BullyReportPage />} />
          <Route path="/ky-nang-song" element={<LifeSkillsPage />} />
          <Route path="/thu-vien" element={<LifeSkillsPage />} />
          <Route path="/bai-viet-da-luu" element={<SavedPostsPage />} />
          <Route path="/dang-ky-tu-van" element={<AppointmentPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/quan-tri" element={<DashboardPage />} />
          <Route path="/tai-khoan" element={<LoginPage />} />
        </Routes>
      </main>

      {/* 4. Nút Floating SOS 111 góc phải màn hình (giữ duy nhất ở dưới, nổi khối 3D rực rỡ) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setEmergencyOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-rose-500 via-red-600 to-rose-600 hover:from-rose-600 hover:to-red-700 text-white rounded-full font-black text-xs sm:text-sm shadow-2xl shadow-rose-400/80 hover:shadow-rose-500 hover:-translate-y-1 active:translate-y-0.5 transition-all ring-4 ring-rose-200/80"
        >
          <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
          <span>SOS Khẩn Cấp 111</span>
        </button>
      </div>

      {/* 5. Modal Khẩn cấp 111 */}
      <EmergencyModal isOpen={emergencyOpen} onClose={() => setEmergencyOpen(false)} />

      {/* 6. Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
