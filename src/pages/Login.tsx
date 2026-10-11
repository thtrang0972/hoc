import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAgeMode } from '../context/AgeModeContext';
import {
  Lock,
  User as UserIcon,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  LogOut,
  Users,
  Copy,
  Check,
} from 'lucide-react';

export const Login: React.FC = () => {
  const { user, login, loginWithGoogle, logout, switchDemoUser, demoUsers } = useAuth();
  const { isPrimary } = useAgeMode();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sampleAccounts = [
    {
      role: 'COUNSELOR',
      roleLabel: 'Giáo viên Tham vấn (Phòng 692)',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      fullName: 'Cô Nguyễn Thị Thùy Trang',
      username: 'tuvan.thuytrang',
      altUids: 'thuytrang.nguyen@school.edu.vn',
      password: 'demo123',
      description: 'Phụ trách phòng tư vấn tâm lý, đồng hành cùng học sinh và phụ huynh',
    },
    {
      role: 'ADMIN',
      roleLabel: 'Quản trị viên / BGH',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      fullName: 'Thầy Phạm Quang Minh (Ban Giám Hiệu)',
      username: 'quantri.minh',
      altUids: 'quantri.minh@school.edu.vn',
      password: 'admin123',
      description: 'Ban Giám Hiệu, xử lý báo cáo khẩn cấp, nhật ký kiểm toán và phân quyền',
    },
  ];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleQuickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    setError(null);
    const ok = await login(u, p);
    setLoading(false);
    if (!ok) setError('Đăng nhập không thành công.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setLoading(true);
    setError(null);
    const success = await login(username, password || 'demo123');
    setLoading(false);

    if (!success) {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Thông báo miễn đăng nhập cho học sinh & phụ huynh */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-sm text-emerald-950">
            Dành cho Học sinh, Phụ huynh & Khách: Không cần đăng nhập!
          </h3>
          <p className="text-xs text-emerald-800 mt-0.5">
            Mọi tính năng của Cổng tư vấn đều mở tự do và ẩn danh 100%. Phần đăng nhập này chỉ dành riêng cho Quản trị viên và Cô Nguyễn Thị Thùy Trang.
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2 max-w-lg mx-auto">
        <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Đăng Nhập Quản Trị & Cô Thùy Trang
        </h1>
        <p className="text-xs text-slate-600">
          Dành riêng cho Ban Giám Hiệu & Cô Nguyễn Thị Thùy Trang (Phòng 692)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Active session card or login form */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {user ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
                <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-xl">
                  {user.fullName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{user.fullName}</h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-sky-200 text-sky-800">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tài khoản: <strong>{user.username}</strong>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Quyền hạn trong hệ thống:
                </h4>
                <ul className="text-slate-600 space-y-1 list-disc list-inside text-xs">
                  {user.role === 'STUDENT' && (
                    <>
                      <li>Gửi phiếu tư vấn và theo dõi tiến độ bằng mã bảo mật riêng</li>
                      <li>Trò chuyện không giới hạn cùng Bạn Đồng Hành (AI)</li>
                      <li>Sử dụng các bài tập thư giãn và đọc thư viện kỹ năng sống</li>
                    </>
                  )}
                  {user.role === 'COUNSELOR' && (
                    <>
                      <li>Tiếp nhận, phân loại và phân công phiếu tư vấn học sinh</li>
                      <li>Thêm ghi chú chuyên môn nội bộ bảo mật</li>
                      <li>Quản lý lịch hẹn tư vấn và điều phối can thiệp</li>
                    </>
                  )}
                  {user.role === 'TEACHER' && (
                    <>
                      <li>Xem các yêu cầu tư vấn liên quan đến khối lớp phụ trách</li>
                      <li>Phối hợp theo dõi tình hình tâm lý học sinh được phân công</li>
                    </>
                  )}
                  {user.role === 'ADMIN' && (
                    <>
                      <li>Quản lý người dùng, cấu hình hệ thống và nhật ký kiểm toán</li>
                      <li>Xem báo cáo thống kê tổng hợp của toàn trường</li>
                    </>
                  )}
                  {user.role === 'PARENT' && (
                    <>
                      <li>Đọc cẩm nang hỗ trợ con tuổi dậy thì và liên hệ ban tư vấn</li>
                    </>
                  )}
                </ul>
              </div>

              <button
                onClick={logout}
                className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản này</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Nhập Thông Tin Tài Khoản
              </h3>

              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên đăng nhập:
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: tuvan.tuananh hoặc hocsinh.an"
                  className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu demo: demo123"
                  className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase">
                  hoặc
                </span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  const ok = await loginWithGoogle();
                  setLoading(false);
                  if (!ok) setError('Đăng nhập bằng tài khoản Google không thành công.');
                }}
                className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập an toàn với Google (OAuth)</span>
              </button>
            </form>
          )}
        </div>

        {/* Right: Quick Demo Accounts Selector */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 text-xs font-bold uppercase tracking-wider">
              <Users className="w-4 h-4 text-sky-600" />
              <span>Chuyển Nhanh Tài Khoản Thử Nghiệm</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bấm vào từng vai trò để trải nghiệm phân quyền đầy đủ của hệ thống:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => switchDemoUser('STUDENT')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">🎓 Học sinh: Trần Hoài An</div>
                  <div className="text-[11px] text-slate-500">Khối 8 (THCS) • Gửi phiếu & chat AI</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => login('tuvan.tuananh', 'demo123')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">🩺 Tư vấn THCS: ThS. Nguyễn Tuấn Anh</div>
                  <div className="text-[11px] text-slate-500">Tài khoản: tuvan.tuananh • Mật khẩu: demo123</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => login('tuvan.thuytrang', 'demo123')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">🌸 Tư vấn Tiểu học: Cô Nguyễn Thị Thùy Trang</div>
                  <div className="text-[11px] text-slate-500">Tài khoản: tuvan.thuytrang • Mật khẩu: demo123</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => switchDemoUser('TEACHER')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">👩‍🏫 Giáo viên: Cô Mai Lan</div>
                  <div className="text-[11px] text-slate-500">GVCN 7A2 • Xem học sinh phụ trách</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => switchDemoUser('PARENT')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">🏡 Phụ huynh: Chị Tuyết Mai</div>
                  <div className="text-[11px] text-slate-500">Phụ huynh học sinh Hoài An</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => switchDemoUser('ADMIN')}
                className="w-full p-3 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 text-left text-xs transition-colors shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">🛡️ Quản trị viên: Thầy Quang Minh</div>
                  <div className="text-[11px] text-slate-500">Ban Giám Hiệu • Báo cáo & Audit logs</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Accounts Reference Table */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
              🔑
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Danh Sách Tài Khoản & Mật Khẩu Đăng Nhập
              </h3>
              <p className="text-xs text-slate-500">
                Hệ thống hỗ trợ đăng nhập bằng Tên đăng nhập (Username), Mã định danh (UID) hoặc Email.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
            Mật khẩu chung: <code className="font-mono font-bold text-slate-800">demo123</code> (Admin: <code className="font-mono font-bold text-slate-800">admin123</code>)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3 px-3">Vai trò</th>
                <th className="py-3 px-3">Họ và tên</th>
                <th className="py-3 px-3">Tên đăng nhập (Username)</th>
                <th className="py-3 px-3">Mã UID thay thế</th>
                <th className="py-3 px-3">Mật khẩu</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sampleAccounts.map((acc) => (
                <tr key={acc.username} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${acc.badgeColor}`}>
                      {acc.roleLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    <div>{acc.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{acc.description}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-sky-700">
                    <div className="flex items-center gap-1.5">
                      <span>{acc.username}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.username, `u-${acc.username}`)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Sao chép tên đăng nhập"
                      >
                        {copiedKey === `u-${acc.username}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {acc.altUids}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span>{acc.password}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.password, `p-${acc.username}`)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Sao chép mật khẩu"
                      >
                        {copiedKey === `p-${acc.username}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleQuickLogin(acc.username, acc.password)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs"
                    >
                      <span>Vào ngay</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
