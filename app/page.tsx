'use client';

import { useState } from 'react';
import { Bell, ChevronDown, CircleUserRound, CreditCard, Home, Inbox, Landmark, Plus, ScanLine, Search, Settings, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const wallets = [
  { name: 'TPBank', detail: 'Tài khoản thanh toán', amount: '18.450.000 ₫', tone: 'violet' },
  { name: 'Techcombank', detail: 'Tài khoản thanh toán', amount: '9.280.000 ₫', tone: 'red' },
  { name: 'MoMo', detail: 'Ví điện tử', amount: '1.245.000 ₫', tone: 'pink' },
];

const transactions = [
  { icon: '🍜', name: 'Bún bò Huế', category: 'Ăn uống', time: 'Hôm nay, 12:35', amount: '- 65.000 ₫' },
  { icon: '🛒', name: 'WinMart', category: 'Đi chợ', time: 'Hôm qua, 19:12', amount: '- 426.000 ₫' },
  { icon: '💼', name: 'Lương tháng 8', category: 'Thu nhập', time: '30 thg 8, 09:00', amount: '+ 24.000.000 ₫', income: true },
];

export default function HomePage() {
  const [pending, setPending] = useState(2);
  const [notice, setNotice] = useState('');

  const approve = () => {
    setPending((value) => Math.max(0, value - 1));
    setNotice('Đã duyệt giao dịch TPBank · 128.000 ₫');
    window.setTimeout(() => setNotice(''), 2600);
  };

  return (
    <main className="min-h-dvh bg-[#f5f7f6] text-[#17231f]">
      {notice && <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-[#17231f] px-4 py-2.5 text-sm font-medium text-white shadow-xl">{notice}</div>}
      <div className="mx-auto grid min-h-dvh max-w-[1480px] grid-cols-1 lg:grid-cols-[250px_1fr]">
        <aside className="hidden border-r border-[#dfe6e2] bg-white px-5 py-7 lg:flex lg:flex-col">
          <div className="mb-9 flex items-center gap-3 px-2">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#d8ff62] text-xl font-black">O</div>
            <div><p className="font-bold leading-none">OhBaby</p><p className="mt-1 text-xs font-semibold text-[#708078]">LoveMoney</p></div>
          </div>
          <nav className="space-y-1.5" aria-label="Điều hướng chính">
            <NavItem icon={<Home />} label="Tổng quan" active />
            <NavItem icon={<Inbox />} label="Chờ duyệt" badge={pending} />
            <NavItem icon={<WalletCards />} label="Tài khoản" />
            <NavItem icon={<ScanLine />} label="Giao dịch" />
            <NavItem icon={<CreditCard />} label="Thẻ & khoản vay" />
            <NavItem icon={<TrendingUp />} label="Ngân sách" />
          </nav>
          <div className="mt-auto space-y-1.5">
            <NavItem icon={<Settings />} label="Cài đặt" />
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f2f5f3]">
              <CircleUserRound className="size-5" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">Danny Nhật</span><ChevronDown className="size-4 text-[#7b8982]" />
            </button>
          </div>
        </aside>

        <section className="min-w-0 pb-24 lg:pb-8">
          <header className="flex h-16 items-center justify-between border-b border-[#dfe6e2] bg-white/90 px-5 backdrop-blur md:px-8">
            <div><p className="text-xs font-semibold text-[#7b8982]">Thứ Ba, 01 tháng 9</p><h1 className="text-lg font-bold tracking-tight">Chào buổi sáng, Danny</h1></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Tìm kiếm"><Search /></Button>
              <Button variant="outline" size="icon" aria-label="Thông báo" className="relative"><Bell />{pending > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#ff665a]" />}</Button>
              <Button className="hidden bg-[#17231f] text-white sm:flex"><Plus /> Thêm giao dịch</Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1120px] space-y-5 px-4 py-5 md:px-8 md:py-7">
            <section className="overflow-hidden rounded-[26px] bg-[#17231f] p-5 text-white shadow-[0_18px_45px_rgba(23,35,31,.15)] md:p-7">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-medium text-white/60">Tổng tài sản ròng</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">34.275.000 ₫</p></div>
                <Badge className="bg-[#d8ff62] text-[#17231f]">+8,4% tháng này</Badge>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 md:max-w-lg">
                <Metric icon={<TrendingUp />} label="Thu nhập" value="24.000.000 ₫" positive />
                <Metric icon={<TrendingDown />} label="Chi tiêu" value="8.420.000 ₫" />
              </div>
              <div className="mt-6 flex h-12 items-end gap-2" aria-label="Biểu đồ dòng tiền 7 ngày">
                {[32, 54, 38, 70, 47, 84, 64, 92, 75, 100, 86, 72].map((height, index) => <span key={index} className="flex-1 rounded-t bg-[#d8ff62]/80" style={{ height: `${height}%`, opacity: 0.35 + index / 20 }} />)}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
              <div className="space-y-5">
                <section className="rounded-[22px] border border-[#dfe6e2] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div><h2 className="font-bold">Giao dịch chờ duyệt</h2><p className="mt-0.5 text-xs text-[#7b8982]">Được phát hiện từ email ngân hàng</p></div>
                    <Badge variant="secondary" className="bg-[#fff1d7] text-[#7a5410]">{pending} giao dịch</Badge>
                  </div>
                  {pending > 0 ? (
                    <div className="rounded-2xl border border-[#eadfca] bg-[#fffbf2] p-4">
                      <div className="flex gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#7d4cff] text-sm font-black text-white">TP</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Thanh toán thẻ TPBank</p><p className="mt-0.5 truncate text-xs text-[#7b8982]">GRAB · 01/09/2026, 08:42</p></div><p className="shrink-0 font-bold">128.000 ₫</p></div>
                          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={approve} className="bg-[#17231f]">Phê duyệt</Button><Button size="sm" variant="outline">Chỉnh sửa</Button><Button size="sm" variant="ghost">Bỏ qua</Button></div>
                        </div>
                      </div>
                    </div>
                  ) : <div className="rounded-2xl bg-[#eff8e8] p-5 text-sm font-medium text-[#416324]">Bạn đã duyệt hết giao dịch.</div>}
                </section>

                <section className="rounded-[22px] border border-[#dfe6e2] bg-white p-5">
                  <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Giao dịch gần đây</h2><Button variant="ghost" size="sm">Xem tất cả</Button></div>
                  <div className="divide-y divide-[#edf1ef]">
                    {transactions.map((transaction) => (
                      <div key={transaction.name} className="flex items-center gap-3 py-3.5">
                        <div className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-lg">{transaction.icon}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{transaction.name}</p><p className="text-xs text-[#7b8982]">{transaction.category} · {transaction.time}</p></div>
                        <p className={`text-sm font-bold ${transaction.income ? 'text-[#2c8a54]' : ''}`}>{transaction.amount}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-[22px] border border-[#dfe6e2] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Tài khoản của bạn</h2><Button variant="ghost" size="icon-sm" aria-label="Thêm tài khoản"><Plus /></Button></div>
                  <div className="space-y-3">
                    {wallets.map((wallet) => (
                      <div key={wallet.name} className="flex items-center gap-3 rounded-2xl bg-[#f6f8f7] p-3">
                        <div className={`bank-logo bank-${wallet.tone}`}><Landmark className="size-4" /></div>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{wallet.name}</p><p className="text-[11px] text-[#7b8982]">{wallet.detail}</p></div>
                        <p className="text-sm font-bold">{wallet.amount}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-[22px] bg-[#e9f2ff] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4c6688]">Ngân sách tháng 9</p>
                  <div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-bold">8.420.000 ₫</p><p className="text-xs font-semibold">trên 15.000.000 ₫</p></div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80"><div className="h-full w-[56%] rounded-full bg-[#3f70d6]" /></div>
                  <p className="mt-3 text-xs text-[#4c6688]">Bạn còn 6.580.000 ₫ cho 29 ngày tới</p>
                </section>
              </div>
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#dfe6e2] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Điều hướng di động">
        <MobileNav icon={<Home />} label="Tổng quan" active /><MobileNav icon={<ScanLine />} label="Giao dịch" />
        <button aria-label="Thêm giao dịch" className="mx-auto -mt-6 grid size-14 place-items-center rounded-full border-4 border-[#f5f7f6] bg-[#d8ff62] text-[#17231f] shadow-lg"><Plus /></button>
        <MobileNav icon={<Inbox />} label="Chờ duyệt" badge={pending} /><MobileNav icon={<CircleUserRound />} label="Cá nhân" />
      </nav>
    </main>
  );
}

function NavItem({ icon, label, active, badge }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number }) {
  return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-[#eaffaa] text-[#17231f]' : 'text-[#5f6e67] hover:bg-[#f2f5f3]'}`}><span className="[&>svg]:size-5">{icon}</span><span className="flex-1 text-left">{label}</span>{badge ? <span className="grid size-5 place-items-center rounded-full bg-[#ff665a] text-[10px] text-white">{badge}</span> : null}</button>;
}

function MobileNav({ icon, label, active, badge }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number }) {
  return <button className={`relative flex flex-col items-center gap-1 text-[10px] font-semibold ${active ? 'text-[#17231f]' : 'text-[#7b8982]'}`}><span className="[&>svg]:size-5">{icon}</span>{label}{badge ? <span className="absolute right-[24%] top-[-4px] grid size-4 place-items-center rounded-full bg-[#ff665a] text-[9px] text-white">{badge}</span> : null}</button>;
}

function Metric({ icon, label, value, positive }: { icon: React.ReactNode; label: string; value: string; positive?: boolean }) {
  return <div className="flex items-center gap-3"><div className={`grid size-9 place-items-center rounded-xl ${positive ? 'bg-[#d8ff62] text-[#17231f]' : 'bg-white/10 text-white'}`}><span className="[&>svg]:size-4">{icon}</span></div><div><p className="text-xs text-white/55">{label}</p><p className="text-sm font-semibold">{value}</p></div></div>;
}
