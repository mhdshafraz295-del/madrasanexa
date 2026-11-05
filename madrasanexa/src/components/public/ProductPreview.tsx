import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  CheckCircle2,
  Bell,
  Search,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

export default function ProductPreview() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
      {/* Ambient background glow accents */}
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#A5A477]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#85845C]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Layered Dashboard Frame */}
      <div className="relative bg-white/85 backdrop-blur-xl border border-white/80 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 overflow-hidden">
        {/* Mock Window Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E9EE] gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-[#7C8A9A] tracking-wider uppercase">
              Madrasa Admin Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F6F1] text-[10px] sm:text-xs text-[#7C8A9A]">
              <Search className="w-3 h-3 text-[#7C8A9A]" />
              <span className="hidden sm:inline">Search records...</span>
            </div>
            <div className="p-1.5 rounded-lg bg-[#F7F6F1] text-[#0F172A]">
              <Bell className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Dashboard Content Mockup */}
        <div className="mt-4 space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#0F172A]">Madrasa Noorul Huda</div>
              <div className="text-[10px] sm:text-xs text-[#7C8A9A]">Academic Year 2026 • Term 2</div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#85845C]/15 text-[#252525] border border-[#85845C]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#85845C]" />
              Active Portal
            </span>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[#F7F6F1] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#E7E9EE]">
              <div className="flex items-center justify-between text-[#7C8A9A] mb-1">
                <span className="text-[10px] sm:text-xs font-medium">Students</span>
                <Users className="w-3 h-3 text-[#0F172A]" />
              </div>
              <div className="text-sm sm:text-lg font-bold text-[#0F172A]">428</div>
              <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-[#85845C] font-medium mt-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>12 Classes</span>
              </div>
            </div>

            <div className="bg-[#F7F6F1] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#E7E9EE]">
              <div className="flex items-center justify-between text-[#7C8A9A] mb-1">
                <span className="text-[10px] sm:text-xs font-medium">Attendance</span>
                <CalendarCheck className="w-3 h-3 text-[#85845C]" />
              </div>
              <div className="text-sm sm:text-lg font-bold text-[#0F172A]">96.4%</div>
              <div className="text-[9px] sm:text-[10px] text-[#85845C] font-medium mt-0.5">
                Today Verified
              </div>
            </div>

            <div className="bg-[#F7F6F1] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#E7E9EE]">
              <div className="flex items-center justify-between text-[#7C8A9A] mb-1">
                <span className="text-[10px] sm:text-xs font-medium">Fee POS</span>
                <CreditCard className="w-3 h-3 text-[#85845C]" />
              </div>
              <div className="text-sm sm:text-lg font-bold text-[#0F172A]">94.2%</div>
              <div className="text-[9px] sm:text-[10px] text-[#0F172A] font-medium mt-0.5">
                Settled
              </div>
            </div>
          </div>

          {/* Mini Attendance Trend Visualization */}
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E7E9EE]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#0F172A]">Weekly Class Attendance Trend</span>
              <span className="text-[10px] font-medium text-[#7C8A9A]">Mon – Fri</span>
            </div>
            <div className="flex items-end justify-between h-16 sm:h-20 gap-2 pt-2 px-1">
              {[
                { day: 'Mon', height: '85%' },
                { day: 'Tue', height: '94%' },
                { day: 'Wed', height: '91%' },
                { day: 'Thu', height: '98%' },
                { day: 'Fri', height: '96%' },
              ].map((bar) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-[#E7E9EE] rounded-t-lg h-full flex items-end">
                    <div
                      style={{ height: bar.height }}
                      className="w-full bg-gradient-to-t from-[#252525] to-[#85845C] rounded-t-lg transition-all"
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-[#7C8A9A] font-medium">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Student Table Shell Snippet */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#E7E9EE] overflow-hidden">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#F7F6F1]/60 border-b border-[#E7E9EE] flex items-center justify-between text-xs font-semibold text-[#0F172A]">
              <span>Recent Enrolled Students</span>
              <span className="text-[10px] text-[#85845C] font-medium flex items-center gap-0.5">
                <span>Directory</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <div className="divide-y divide-[#E7E9EE] text-[11px] sm:text-xs">
              {[
                { name: 'Muhammad Rayyan', class: 'Grade 7 - Hifz', status: 'Enrolled', id: 'STD-0428' },
                { name: 'Fathima Zainab', class: 'Grade 5 - Aalim', status: 'Enrolled', id: 'STD-0429' },
              ].map((std) => (
                <div key={std.id} className="px-3 sm:px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#0F172A]/10 text-[#0F172A] flex items-center justify-center font-bold text-[10px]">
                      {std.name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-[#0F172A]">{std.name}</div>
                      <div className="text-[9px] sm:text-[10px] text-[#7C8A9A]">{std.class}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#85845C] font-semibold bg-[#F5F5F1] px-2 py-0.5 rounded-md border border-[#E5E5DF]">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>{std.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Glass Chips Accents */}
        <div className="absolute top-16 -right-4 sm:-right-6 bg-white/90 backdrop-blur-md border border-white/70 shadow-lg px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold text-[#0F172A] animate-bounce-slow">
          <GraduationCap className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Tenant Isolated</span>
        </div>

        <div className="absolute bottom-6 -left-3 sm:-left-4 bg-[#252525]/90 backdrop-blur-md border border-white/20 shadow-xl px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold text-white">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Automated Receipts</span>
        </div>
      </div>
    </div>
  );
}
