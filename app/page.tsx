'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Bell, ChevronDown, CircleUserRound, CreditCard, HandCoins, Home, Inbox, Landmark, LogOut, Plus, ScanLine, Search, Settings, TrendingDown, TrendingUp, WalletCards, X } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cashSignFor, debtActions, expenseOptions, incomeOptions, reportingBucketFor, type DebtAction, type TransactionGroup } from '@/lib/finance-taxonomy';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type View = 'overview' | 'pending' | 'transactions' | 'accounts' | 'cards' | 'budgets' | 'debts';
type Transaction = { id: string; icon: string; name: string; category: string; time: string; amount: number; group: TransactionGroup; reporting: 'income' | 'expense' | 'none'; debtAction?: DebtAction; debtId?: string; person?: string; due?: string };
type Budget = { id: string; icon: string; name: string; spent: number; limit: number; color: string };
type Debt = { id: string; person: string; type: 'owe' | 'lend'; total: number; paid: number; due: string };
type PendingImport = { id: string; bank: string; merchant: string; amount: number; time: string; category: string; group: 'expense' | 'income' };

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
const initialTransactions: Transaction[] = [
  { id: 't1', icon: '🍜', name: 'Bún bò Huế', category: 'Ăn uống', time: 'Hôm nay, 12:35', amount: -65000, group: 'expense', reporting: 'expense' },
  { id: 't2', icon: '🛒', name: 'WinMart', category: 'Mua sắm › Đồ dùng cá nhân', time: 'Hôm qua, 19:12', amount: -426000, group: 'expense', reporting: 'expense' },
  { id: 't3', icon: '💼', name: 'Lương tháng 8', category: 'Lương', time: '30 thg 8, 09:00', amount: 24000000, group: 'income', reporting: 'income' },
];
const initialBudgets: Budget[] = [
  { id: 'b1', icon: '🍜', name: 'Ăn uống', spent: 1250000, limit: 2000000, color: '#e66c5c' },
  { id: 'b2', icon: '🛵', name: 'Đi lại', spent: 420000, limit: 1000000, color: '#477dd1' },
  { id: 'b3', icon: '📚', name: 'Đầu tư bản thân', spent: 350000, limit: 1000000, color: '#7b55c7' },
];
const initialDebts: Debt[] = [
  { id: 'd1', person: 'Anh Minh', type: 'owe', total: 5000000, paid: 2000000, due: '15/09/2026' },
  { id: 'd2', person: 'Huy', type: 'lend', total: 3000000, paid: 1000000, due: '30/09/2026' },
];
const initialPending: PendingImport[] = [
  { id: 'p1', bank: 'TPBank', merchant: 'GRAB', amount: 128000, time: '01/09/2026, 08:42', category: '', group: 'expense' },
  { id: 'p2', bank: 'Techcombank', merchant: 'SHOPEE', amount: 389000, time: '31/08/2026, 21:06', category: '', group: 'expense' },
];

export default function HomePage() {
  const [view, setView] = useState<View>('overview');
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [debts, setDebts] = useState(initialDebts);
  const [pending, setPending] = useState(initialPending);
  const [cardBalance, setCardBalance] = useState(8400000);
  const [cardLimit, setCardLimit] = useState(30000000);
  const [modal, setModal] = useState<'transaction' | 'budget' | 'debt' | null>(null);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'local' | 'error'>('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [authState, setAuthState] = useState<'loading' | 'unconfigured' | 'signed_out' | 'signed_in'>('loading');

  useEffect(() => {
    const applyData = (data: any) => {
      if (!data) return;
        if (data.transactions) setTransactions(data.transactions.map((item: Transaction) => ({
          ...item,
          group: item.group ?? (item.amount > 0 ? 'income' : 'expense'),
          reporting: item.reporting ?? (item.amount > 0 ? 'income' : 'expense'),
        })));
        if (data.budgets) setBudgets(data.budgets);
        if (data.debts) setDebts(data.debts);
        if (data.pending) setPending(data.pending.map((item: PendingImport) => ({ ...item, group: item.group ?? 'expense' })));
        if (typeof data.cardBalance === 'number') setCardBalance(data.cardBalance);
        if (typeof data.cardLimit === 'number') setCardLimit(data.cardLimit);
    };

    const load = async () => {
      let localData: any = null;
      try {
        const saved = localStorage.getItem('ohbabylovemoney-data-v2');
        if (saved) localData = JSON.parse(saved);
      } catch { /* bộ nhớ cục bộ chỉ là bản dự phòng */ }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        applyData(localData);
        setAuthState('unconfigured');
        setSyncStatus(localData ? 'local' : 'error');
        setReady(true);
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          applyData(localData);
          setAuthState('signed_out');
          setSyncStatus('local');
          setReady(true);
          return;
        }
        setAccountId(authData.user.id);
        setAccountEmail(authData.user.email || '');
        const { data: cloud, error: cloudError } = await supabase.from('user_app_state').select('payload').eq('user_id', authData.user.id).maybeSingle();
        if (cloudError) throw cloudError;
        applyData(cloud?.payload ?? localData);
        setAuthState('signed_in');
        setSyncStatus('synced');
      } catch {
        applyData(localData);
        setAuthState('signed_in');
        setSyncStatus(localData ? 'local' : 'error');
      }
      setReady(true);
    };

    void load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const data = { transactions, budgets, debts, pending, cardBalance, cardLimit };
    localStorage.setItem('ohbabylovemoney-data-v2', JSON.stringify(data));
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || authState !== 'signed_in' || !accountId) return;
      try {
        const { error } = await supabase.from('user_app_state').upsert({ user_id: accountId, email: accountEmail, payload: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('local');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [ready, authState, accountId, accountEmail, transactions, budgets, debts, pending, cardBalance, cardLimit]);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const title: Record<View, string> = { overview: 'Tổng quan', pending: 'Giao dịch chờ duyệt', transactions: 'Tất cả giao dịch', accounts: 'Tài khoản của bạn', cards: 'Thẻ tín dụng', budgets: 'Ngân sách theo danh mục', debts: 'Nợ & cho vay' };

  if (authState === 'loading') return <main className="grid min-h-dvh place-items-center bg-[#fffafb]"><Image src="/app-icon.png" alt="OhBabyLoveMoney" width={96} height={96} priority className="size-24 rounded-[26px]" /></main>;
  if (authState === 'signed_out' || authState === 'unconfigured') return <GoogleSignIn configured={authState !== 'unconfigured'} />;

  return (
    <main className="min-h-dvh bg-[#f5f7f6] text-[#17231f]">
      {notice && <div role="status" className="fixed left-1/2 top-4 z-[80] w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-[#17231f] px-4 py-2.5 text-center text-sm font-medium text-white shadow-xl">{notice}</div>}
      <div className="mx-auto grid min-h-dvh max-w-[1480px] grid-cols-1 lg:grid-cols-[250px_1fr]">
        <Sidebar view={view} pending={pending.length} email={accountEmail} onView={setView} onInfo={() => toast(accountEmail || 'Tài khoản Google')} onSignOut={async () => { const supabase = getSupabaseBrowserClient(); await supabase?.auth.signOut(); window.location.assign('/'); }} />
        <section className="min-w-0 pb-24 lg:pb-8">
          <header className="flex h-16 items-center justify-between border-b border-[#dfe6e2] bg-white/90 px-5 backdrop-blur md:px-8">
            <div><p className="text-xs font-semibold text-[#7b8982]">OhBabyLoveMoney</p><h1 className="text-lg font-bold tracking-tight">{title[view]}</h1></div>
            <div className="flex items-center gap-2">
              <button onClick={() => toast(accountEmail ? `Cloud: ${accountEmail}` : 'Đang dùng bản lưu dự phòng trên thiết bị')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold md:block ${syncStatus==='synced'?'bg-[#eaf7ee] text-[#257545]':'bg-[#fff1d7] text-[#7a5410]'}`}>{syncStatus==='loading'?'Đang tải…':syncStatus==='synced'?'Cloud đã đồng bộ':'Đang lưu trên máy'}</button>
              <Button variant="outline" size="icon" aria-label="Tìm kiếm" onClick={() => toast('Tìm kiếm sẽ có ở bản tiếp theo')}><Search /></Button>
              <Button variant="outline" size="icon" aria-label="Thông báo" onClick={() => setView('pending')} className="relative"><Bell />{pending.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#ff665a]" />}</Button>
              <Button data-testid="add-transaction" onClick={() => setModal('transaction')} className="hidden bg-[#17231f] text-white sm:flex"><Plus /> Thêm giao dịch</Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1120px] px-4 py-5 md:px-8 md:py-7">
            {['budgets', 'debts', 'cards', 'accounts'].includes(view) && <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {([['budgets','Ngân sách'],['debts','Nợ & cho vay'],['cards','Thẻ tín dụng'],['accounts','Tài khoản']] as [View,string][]).map(([item,label]) => <button key={item} onClick={() => setView(item)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${view===item?'bg-[#17231f] text-white':'border border-[#d9dfdc] bg-white text-[#5f6e67]'}`}>{label}</button>)}
            </div>}
            {view === 'overview' && <Overview transactions={transactions} budgets={budgets} pending={pending} onView={setView} onApprove={(id) => approvePending(id, pending, setPending, setTransactions, toast)} />}
            {view === 'transactions' && <TransactionsView transactions={transactions} />}
            {view === 'pending' && <PendingView pending={pending} onGroup={(id, group) => setPending((items) => items.map((item) => item.id === id ? { ...item, group, category: '' } : item))} onCategory={(id, category) => setPending((items) => items.map((item) => item.id === id ? { ...item, category } : item))} onApprove={(id) => approvePending(id, pending, setPending, setTransactions, toast)} onIgnore={(id) => { setPending((items) => items.filter((item) => item.id !== id)); toast('Đã bỏ qua email giao dịch'); }} />}
            {view === 'budgets' && <BudgetsView budgets={budgets} onAdd={() => setModal('budget')} onChangeLimit={(id, limit) => setBudgets((items) => items.map((item) => item.id === id ? { ...item, limit } : item))} />}
            {view === 'debts' && <DebtsView debts={debts} onAdd={() => setModal('debt')} onPay={(id, amount) => { setDebts((items) => items.map((item) => item.id === id ? { ...item, paid: Math.min(item.total, item.paid + amount) } : item)); toast('Đã cập nhật tiến độ thanh toán'); }} />}
            {view === 'cards' && <CardsView balance={cardBalance} limit={cardLimit} onLimit={setCardLimit} onSettle={() => { setCardBalance(0); toast('Đã tất toán. Hạn mức khả dụng đã phục hồi.'); }} />}
            {view === 'accounts' && <AccountsView />}
          </div>
        </section>
      </div>

      <MobileNav view={view} pending={pending.length} onView={setView} onAdd={() => setModal('transaction')} />
      {modal && <Modal title={modal === 'transaction' ? 'Thêm giao dịch' : modal === 'budget' ? 'Tạo ngân sách danh mục' : 'Thêm khoản nợ / cho vay'} onClose={() => setModal(null)}>
        {modal === 'transaction' && <TransactionForm debts={debts} onSave={(transaction) => {
          setTransactions((items) => [transaction, ...items]);
          if (transaction.group === 'debt' && transaction.debtAction) {
            if (transaction.debtAction === 'lend' || transaction.debtAction === 'borrow') {
              setDebts((items) => [...items, { id: crypto.randomUUID(), person: transaction.person || 'Chưa đặt tên', type: transaction.debtAction === 'lend' ? 'lend' : 'owe', total: Math.abs(transaction.amount), paid: 0, due: transaction.due || 'Chưa đặt hạn' }]);
            } else if (transaction.debtId) {
              setDebts((items) => items.map((item) => item.id === transaction.debtId ? { ...item, paid: Math.min(item.total, item.paid + Math.abs(transaction.amount)) } : item));
            }
          }
          setModal(null); toast(transaction.reporting === 'none' ? 'Đã ghi nhận biến động tiền và công nợ' : 'Đã thêm giao dịch mới');
        }} />}
        {modal === 'budget' && <BudgetForm onSave={(budget) => { setBudgets((items) => [...items, budget]); setModal(null); toast('Đã tạo ngân sách danh mục'); }} />}
        {modal === 'debt' && <DebtForm onSave={(debt) => { setDebts((items) => [...items, debt]); setModal(null); toast('Đã thêm khoản nợ'); }} />}
      </Modal>}
    </main>
  );
}

function GoogleSignIn({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const signIn = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage('Chưa có cấu hình Supabase trên Vercel. Hãy thêm 2 Environment Variables được hướng dẫn bên dưới.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) {
      setBusy(false);
      setErrorMessage(`Không thể mở đăng nhập Google: ${error.message}`);
    }
  };
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const callbackError = params?.get('auth_error');
  return <main className="grid min-h-dvh place-items-center bg-[#fffafb] p-5 text-[#17231f]"><section className="w-full max-w-md rounded-[28px] border border-[#f0e1e5] bg-white p-7 text-center shadow-[0_24px_60px_rgba(23,35,31,.10)]"><Image src="/logo-full.png" alt="Oh Baby Love Money" width={280} height={280} priority className="mx-auto h-auto w-[230px]" /><h1 className="mt-2 text-2xl font-bold">Đăng nhập OhBabyLoveMoney</h1><p className="mt-2 text-sm leading-6 text-[#66756e]">Dữ liệu tài chính được tách riêng và đồng bộ theo tài khoản Google của bạn.</p>{(!configured || callbackError || errorMessage) && <div role="alert" className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-left text-xs leading-5 text-[#8b3d34]">{errorMessage || (callbackError === 'oauth' ? 'Google chưa được bật hoặc callback URL chưa đúng trong Supabase.' : callbackError ? 'Cấu hình đăng nhập chưa hoàn tất.' : 'Chưa kết nối Supabase trên Vercel nên Google Login chưa thể hoạt động.')}</div>}<Button onClick={signIn} disabled={busy || !configured} className="mt-6 h-12 w-full bg-[#17231f] text-white"><span className="grid size-6 place-items-center rounded-full bg-white font-bold text-[#4285f4]">G</span>{busy?'Đang chuyển đến Google…':'Tiếp tục với Google'}</Button>{!configured && <p className="mt-3 text-xs leading-5 text-[#849189]">Cần thêm <code>NEXT_PUBLIC_SUPABASE_URL</code> và <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> trong Vercel rồi Redeploy.</p>}<p className="mt-4 text-xs leading-5 text-[#849189]">Ứng dụng không nhận hoặc lưu mật khẩu Google.</p></section></main>;
}

function Sidebar({ view, pending, email, onView, onInfo, onSignOut }: { view: View; pending: number; email: string; onView: (view: View) => void; onInfo: () => void; onSignOut: () => void }) {
  return <aside className="hidden border-r border-[#dfe6e2] bg-white px-5 py-7 lg:flex lg:flex-col">
    <div className="mb-9 flex items-center gap-3 px-2"><Image src="/app-icon.png" alt="" width={44} height={44} className="size-11 rounded-2xl" /><div><p className="font-bold leading-none">OhBaby</p><p className="mt-1 text-xs font-semibold text-[#708078]">LoveMoney</p></div></div>
    <nav className="space-y-1.5" aria-label="Điều hướng chính">
      <NavItem icon={<Home />} label="Tổng quan" active={view === 'overview'} onClick={() => onView('overview')} />
      <NavItem icon={<Inbox />} label="Chờ duyệt" active={view === 'pending'} badge={pending} onClick={() => onView('pending')} />
      <NavItem icon={<ScanLine />} label="Giao dịch" active={view === 'transactions'} onClick={() => onView('transactions')} />
      <NavItem icon={<WalletCards />} label="Tài khoản" active={view === 'accounts'} onClick={() => onView('accounts')} />
      <NavItem icon={<TrendingUp />} label="Ngân sách" active={view === 'budgets'} onClick={() => onView('budgets')} />
      <NavItem icon={<HandCoins />} label="Nợ & cho vay" active={view === 'debts'} onClick={() => onView('debts')} />
      <NavItem icon={<CreditCard />} label="Thẻ tín dụng" active={view === 'cards'} onClick={() => onView('cards')} />
    </nav>
    <div className="mt-auto space-y-1.5"><NavItem icon={<Settings />} label="Cài đặt" onClick={onInfo} /><button onClick={onInfo} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f2f5f3]"><CircleUserRound className="size-5" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{email || 'Tài khoản Google'}</span><ChevronDown className="size-4 text-[#7b8982]" /></button><NavItem icon={<LogOut />} label="Đăng xuất" onClick={onSignOut} /></div>
  </aside>;
}

function Overview({ transactions, budgets, pending, onView, onApprove }: { transactions: Transaction[]; budgets: Budget[]; pending: PendingImport[]; onView: (view: View) => void; onApprove: (id: string) => void }) {
  const expense = Math.abs(transactions.filter((t) => t.reporting === 'expense').reduce((sum, item) => sum + item.amount, 0));
  const income = transactions.filter((t) => t.reporting === 'income').reduce((sum, item) => sum + item.amount, 0);
  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[26px] bg-[#17231f] p-5 text-white shadow-[0_18px_45px_rgba(23,35,31,.15)] md:p-7">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/60">Tổng tài sản ròng</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">34.275.000 ₫</p></div><Badge className="bg-[#d8ff62] text-[#17231f]">+8,4% tháng này</Badge></div>
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 md:max-w-lg"><Metric icon={<TrendingUp />} label="Thu nhập" value={money(income)} positive /><Metric icon={<TrendingDown />} label="Chi tiêu" value={money(expense)} /></div>
      <div className="mt-6 flex h-12 items-end gap-2">{[32,54,38,70,47,84,64,92,75,100,86,72].map((height,index) => <span key={index} className="flex-1 rounded-t bg-[#d8ff62]/80" style={{height:`${height}%`,opacity:.35+index/20}} />)}</div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.85fr]">
      <div className="space-y-5">
        <section className="surface"><SectionTitle title="Giao dịch chờ duyệt" subtitle="Phải chọn danh mục trước khi ghi nhận" action={<Button variant="ghost" size="sm" onClick={() => onView('pending')}>Xem tất cả</Button>} />
          {pending[0] ? <PendingCard item={pending[0]} compact onCategory={() => onView('pending')} onApprove={() => onApprove(pending[0].id)} onIgnore={() => undefined} /> : <Empty text="Bạn đã xử lý hết email giao dịch." />}
        </section>
        <section className="surface"><SectionTitle title="Giao dịch gần đây" action={<Button variant="ghost" size="sm" onClick={() => onView('transactions')}>Xem tất cả</Button>} /><TransactionList transactions={transactions.slice(0, 4)} /></section>
      </div>
      <div className="space-y-5">
        <section className="surface"><SectionTitle title="Ngân sách danh mục" action={<Button variant="ghost" size="sm" onClick={() => onView('budgets')}>Quản lý</Button>} /><div className="space-y-4">{budgets.slice(0,3).map((budget) => <BudgetRow key={budget.id} budget={budget} />)}</div></section>
        <section className="rounded-[22px] bg-[#e9f2ff] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4c6688]">Tổng ngân sách tháng 9</p><p className="mt-2 text-2xl font-bold">{money(budgets.reduce((sum,b) => sum+b.limit,0))}</p><p className="mt-2 text-xs text-[#4c6688]">Theo dõi riêng từng danh mục để không chi quá tay.</p></section>
      </div>
    </div>
  </div>;
}

function PendingView({ pending, onGroup, onCategory, onApprove, onIgnore }: { pending: PendingImport[]; onGroup: (id: string, value: 'expense' | 'income') => void; onCategory: (id: string, value: string) => void; onApprove: (id: string) => void; onIgnore: (id: string) => void }) {
  return <div className="space-y-4"><div className="rounded-2xl border border-[#d9e7bd] bg-[#f4fae9] p-4 text-sm text-[#405521]"><strong>Quy tắc an toàn:</strong> Email chỉ tạo bản nháp. Bạn phải kiểm tra loại giao dịch và chọn danh mục trước khi phê duyệt.</div>{pending.length ? pending.map((item) => <PendingCard key={item.id} item={item} onGroup={(value) => onGroup(item.id,value)} onCategory={(value) => onCategory(item.id,value)} onApprove={() => onApprove(item.id)} onIgnore={() => onIgnore(item.id)} />) : <Empty text="Không còn giao dịch chờ duyệt." />}</div>;
}

function PendingCard({ item, compact, onGroup, onCategory, onApprove, onIgnore }: { item: PendingImport; compact?: boolean; onGroup?: (value: 'expense' | 'income') => void; onCategory: (value: string) => void; onApprove: () => void; onIgnore: () => void }) {
  const options = item.group === 'income' ? incomeOptions : expenseOptions;
  return <article className="rounded-2xl border border-[#eadfca] bg-[#fffbf2] p-4" data-testid={`pending-${item.id}`}><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#7d4cff] text-xs font-black text-white">{item.bank.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.merchant}</p><p className="mt-.5 text-xs text-[#7b8982]">{item.bank} · {item.time}</p></div><p className="shrink-0 font-bold">{money(item.amount)}</p></div>{!compact && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-[#5f6e67]">Loại giao dịch<select aria-label={`Loại ${item.merchant}`} value={item.group} onChange={(e) => onGroup?.(e.target.value as 'expense' | 'income')} className="mt-1.5 h-10 w-full rounded-xl border border-[#d9dfdc] bg-white px-3 text-sm"><option value="expense">Khoản Chi</option><option value="income">Khoản Thu</option></select></label><label className="block text-xs font-semibold text-[#5f6e67]">Danh mục<select aria-label={`Danh mục ${item.merchant}`} value={item.category} onChange={(e) => onCategory(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#d9dfdc] bg-white px-3 text-sm"><option value="">Chọn danh mục trước khi duyệt</option>{options.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label></div>}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={onApprove}>Phê duyệt</Button>{compact ? <Button size="sm" variant="outline" onClick={() => onCategory('')}>Phân loại</Button> : <Button size="sm" variant="ghost" onClick={onIgnore}>Bỏ qua</Button>}</div></div></div></article>;
}

function BudgetsView({ budgets, onAdd, onChangeLimit }: { budgets: Budget[]; onAdd: () => void; onChangeLimit: (id: string, limit: number) => void }) {
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><p className="text-sm text-[#708078]">Tháng 9/2026</p><p className="text-2xl font-bold">{money(budgets.reduce((sum,b) => sum+b.limit,0))}</p></div><Button onClick={onAdd}><Plus /> Thêm danh mục</Button></div><div className="grid gap-4 md:grid-cols-2">{budgets.map((budget) => <article key={budget.id} className="surface"><BudgetRow budget={budget} /><label className="mt-5 block text-xs font-semibold text-[#5f6e67]">Hạn mức danh mục<input aria-label={`Hạn mức ${budget.name}`} type="number" value={budget.limit} onChange={(e) => onChangeLimit(budget.id, Number(e.target.value))} className="field mt-1.5" /></label></article>)}</div></div>;
}

function BudgetRow({ budget }: { budget: Budget }) { const ratio = Math.min(100, Math.round(budget.spent/budget.limit*100)); return <div><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-lg">{budget.icon}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{budget.name}</p><p className="text-xs font-bold">{ratio}%</p></div><p className="text-xs text-[#7b8982]">{money(budget.spent)} / {money(budget.limit)}</p></div></div><div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full rounded-full" style={{width:`${ratio}%`,background:budget.color}} /></div></div>; }

function DebtsView({ debts, onAdd, onPay }: { debts: Debt[]; onAdd: () => void; onPay: (id: string, amount: number) => void }) {
  const owe = debts.filter((d) => d.type === 'owe').reduce((s,d) => s+d.total-d.paid,0); const lend = debts.filter((d) => d.type === 'lend').reduce((s,d) => s+d.total-d.paid,0);
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><SummaryCard icon={<ArrowUpRight />} label="Bạn còn phải trả" value={money(owe)} tone="red" /><SummaryCard icon={<ArrowDownLeft />} label="Người khác còn nợ bạn" value={money(lend)} tone="green" /></div><div className="flex justify-end"><Button onClick={onAdd}><Plus /> Thêm khoản mới</Button></div><div className="grid gap-4 md:grid-cols-2">{debts.map((debt) => { const remain=debt.total-debt.paid; const ratio=Math.round(debt.paid/debt.total*100); return <article key={debt.id} className="surface"><div className="flex items-start justify-between"><div><Badge variant="secondary" className={debt.type==='owe'?'bg-[#fff0ed] text-[#a94135]':'bg-[#eaf7ee] text-[#257545]'}>{debt.type==='owe'?'Bạn đang nợ':'Bạn cho vay'}</Badge><h3 className="mt-3 text-lg font-bold">{debt.person}</h3><p className="text-xs text-[#7b8982]">Hạn trả: {debt.due}</p></div><HandCoins className="size-6 text-[#7b8982]" /></div><div className="mt-5 flex justify-between text-sm"><span>Còn lại</span><strong>{money(remain)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full rounded-full bg-[#7b55c7]" style={{width:`${ratio}%`}} /></div><p className="mt-2 text-xs text-[#7b8982]">Đã thanh toán {money(debt.paid)} / {money(debt.total)}</p>{remain>0?<Button className="mt-4 w-full" variant="outline" onClick={() => onPay(debt.id,Math.min(500000,remain))}>Ghi nhận trả 500.000 ₫</Button>:<div className="mt-4 rounded-xl bg-[#eaf7ee] p-2.5 text-center text-sm font-semibold text-[#257545]">Đã hoàn tất</div>}</article>; })}</div></div>;
}

function CardsView({ balance, limit, onLimit, onSettle }: { balance: number; limit: number; onLimit: (value: number) => void; onSettle: () => void }) {
  const available=Math.max(0,limit-balance); const ratio=Math.min(100,Math.round(balance/limit*100));
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-[26px] bg-gradient-to-br from-[#623cc5] to-[#332165] p-6 text-white shadow-xl"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-[.15em] text-white/60">TPBank EVO Visa</p><p className="mt-7 text-2xl font-bold">•••• 1962</p></div><CreditCard className="size-8 text-white/70" /></div><div className="mt-10 grid grid-cols-2 gap-4"><div><p className="text-xs text-white/60">Dư nợ hiện tại</p><p className="font-bold">{money(balance)}</p></div><div><p className="text-xs text-white/60">Hạn mức khả dụng</p><p className="font-bold">{money(available)}</p></div></div></section><section className="surface"><h2 className="font-bold">Chu kỳ thanh toán</h2><div className="mt-4 grid grid-cols-2 gap-3"><Info label="Ngày chốt sao kê" value="Ngày 12 hàng tháng" /><Info label="Ngày đáo hạn" value="Ngày 27 hàng tháng" /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full bg-[#7b55c7]" style={{width:`${ratio}%`}} /></div><p className="mt-2 text-xs text-[#7b8982]">Đã dùng {ratio}% hạn mức</p><label className="mt-5 block text-xs font-semibold">Hạn mức thẻ<input aria-label="Hạn mức thẻ tín dụng" className="field mt-1.5" type="number" value={limit} onChange={(e) => onLimit(Number(e.target.value))} /></label><Button className="mt-4 w-full" disabled={balance===0} onClick={onSettle}>Tất toán dư nợ</Button><p className="mt-2 text-center text-[11px] text-[#7b8982]">Sau khi tất toán, hạn mức khả dụng tự động trở về đầy đủ.</p></section></div>;
}

function AccountsView() { const wallets=[['TPBank','Tài khoản thanh toán','18.450.000 ₫','#7d4cff'],['Techcombank','Tài khoản thanh toán','9.280.000 ₫','#d94b4b'],['MoMo','Ví điện tử','1.245.000 ₫','#d92b72'],['Vietcombank','Tài khoản thanh toán','5.300.000 ₫','#18885d']]; return <div className="grid gap-4 md:grid-cols-2">{wallets.map(([name,detail,amount,color]) => <article key={name} className="surface flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl text-white" style={{background:color}}><Landmark /></div><div className="flex-1"><p className="font-bold">{name}</p><p className="text-xs text-[#7b8982]">{detail}</p></div><p className="font-bold">{amount}</p></article>)}</div>; }
function TransactionsView({ transactions }: { transactions: Transaction[] }) { return <section className="surface"><SectionTitle title={`${transactions.length} giao dịch`} subtitle="Dữ liệu đã được ghi nhận" /><TransactionList transactions={transactions} /></section>; }
function TransactionList({ transactions }: { transactions: Transaction[] }) { return <div className="divide-y divide-[#edf1ef]">{transactions.map((t) => <div key={t.id} className="flex items-center gap-3 py-3.5"><div className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-lg">{t.icon}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.name}</p><p className="text-xs text-[#7b8982]">{t.category} · {t.time}</p>{t.reporting === 'none' && <p className="mt-0.5 text-[10px] font-semibold text-[#7b55c7]">Biến động tài sản/công nợ · không tính thu chi</p>}</div><p className={`text-sm font-bold ${t.amount>0?'text-[#2c8a54]':''}`}>{t.amount>0?'+ ': '- '}{money(Math.abs(t.amount))}</p></div>)}</div>; }

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if(e.target===e.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full overflow-auto rounded-t-[26px] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[26px]"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}><X /></Button></div>{children}</section></div>; }
function TransactionForm({ debts, onSave }: { debts: Debt[]; onSave: (item: Transaction) => void }) {
  const [name,setName]=useState('');
  const [amount,setAmount]=useState('');
  const [category,setCategory]=useState(expenseOptions[0].value);
  const [customCategory,setCustomCategory]=useState('');
  const [group,setGroup]=useState<TransactionGroup>('expense');
  const [debtAction,setDebtAction]=useState<DebtAction>('lend');
  const [person,setPerson]=useState('');
  const [debtId,setDebtId]=useState('');
  const [due,setDue]=useState('');
  const matchingDebts = debts.filter((debt) => debt.total > debt.paid && (debtAction === 'repay' ? debt.type === 'owe' : debt.type === 'lend'));
  const activeDebt = debts.find((debt) => debt.id === debtId);
  const options = group === 'income' ? incomeOptions : expenseOptions;

  const changeGroup = (value: TransactionGroup) => {
    setGroup(value);
    setCategory(value === 'income' ? incomeOptions[0].value : expenseOptions[0].value);
  };

  return <form onSubmit={(e)=>{
    e.preventDefault();
    if(!amount) return;
    const selectedDebt = activeDebt;
    const actionLabel = debtActions.find((item) => item.value === debtAction)?.label || 'Vay/Nợ';
    const transactionName = group === 'debt' ? `${actionLabel}${selectedDebt ? ` · ${selectedDebt.person}` : person ? ` · ${person}` : ''}` : name;
    if (!transactionName || (group === 'debt' && ['lend','borrow'].includes(debtAction) && (!person || !due)) || (group === 'debt' && ['repay','collect'].includes(debtAction) && !debtId)) return;
    const selectedCategory = group === 'debt' ? actionLabel : category === '__custom__' ? customCategory.trim() : category;
    if (!selectedCategory) return;
    const reporting = reportingBucketFor(group, selectedCategory);
    onSave({ id:crypto.randomUUID(), icon:group==='income'?'💼':group==='expense'?'💳':'🤝', name:transactionName, category:selectedCategory, time:'Vừa xong', amount:cashSignFor(group,debtAction)*Number(amount), group, reporting, debtAction:group==='debt'?debtAction:undefined, debtId:debtId||undefined, person:person||undefined, due:due?new Date(`${due}T00:00:00`).toLocaleDateString('vi-VN'):undefined });
  }} className="space-y-4">
    <Field label="Loại giao dịch"><select aria-label="Loại giao dịch" className="field" value={group} onChange={(e)=>changeGroup(e.target.value as TransactionGroup)}><option value="expense">Khoản Chi</option><option value="income">Khoản Thu</option><option value="debt">Vay/Nợ</option></select></Field>
    {group !== 'debt' && <><Field label="Nội dung"><input className="field" placeholder={group==='income'?'Ví dụ: Lương tháng 9':'Ví dụ: Ăn trưa'} value={name} onChange={(e)=>setName(e.target.value)} required /></Field><Field label="Danh mục"><select aria-label="Danh mục giao dịch" className="field" value={category} onChange={(e)=>setCategory(e.target.value)}>{options.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}<option value="__custom__">＋ Danh mục tùy chỉnh</option></select></Field>{category==='__custom__'&&<Field label="Tên danh mục mới"><input aria-label="Tên danh mục mới" className="field" placeholder="Nhập tên danh mục" value={customCategory} onChange={(e)=>setCustomCategory(e.target.value)} required /></Field>}</>}
    {group === 'debt' && <><Field label="Nghiệp vụ công nợ"><select aria-label="Nghiệp vụ công nợ" className="field" value={debtAction} onChange={(e)=>{setDebtAction(e.target.value as DebtAction);setDebtId('');}}>{debtActions.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>{['lend','borrow'].includes(debtAction)?<><Field label="Người liên quan"><input className="field" placeholder="Tên người" value={person} onChange={(e)=>setPerson(e.target.value)} required /></Field><Field label="Ngày đến hạn"><input className="field" type="date" value={due} onChange={(e)=>setDue(e.target.value)} required /></Field></>:<Field label={debtAction==='repay'?'Khoản bạn cần trả':'Khoản bạn cần thu'}><select aria-label="Khoản công nợ" className="field" value={debtId} onChange={(e)=>setDebtId(e.target.value)} required><option value="">Chọn người và khoản nợ</option>{matchingDebts.map((debt)=><option key={debt.id} value={debt.id}>{debt.person} · còn {money(debt.total-debt.paid)}</option>)}</select></Field>}</>}
    <Field label="Số tiền"><input className="field" type="number" min="1" max={activeDebt ? activeDebt.total-activeDebt.paid : undefined} inputMode="numeric" placeholder="0" value={amount} onChange={(e)=>setAmount(e.target.value)} required /></Field>
    {group==='debt'&&<div className="rounded-xl bg-[#f3effc] p-3 text-xs text-[#5c3b91]">{debtAction==='lend'?'Tiền giảm, khoản phải thu tăng. Không tính là chi tiêu.':debtAction==='borrow'?'Tiền tăng, khoản phải trả tăng. Không tính là thu nhập.':debtAction==='repay'?'Tiền giảm và khoản phải trả giảm. Không tính là chi tiêu mới.':'Tiền tăng và khoản phải thu giảm. Không tính là thu nhập mới.'}</div>}
    {(category==='Tiền chuyển đi'||category==='Tiền chuyển đến')&&group!=='debt'&&<div className="rounded-xl bg-[#fff7df] p-3 text-xs text-[#735b16]">Chuyển tiền chỉ làm đổi vị trí tiền giữa các tài khoản, không tính vào báo cáo thu nhập hoặc chi tiêu.</div>}
    <Button type="submit" className="h-11 w-full">Lưu giao dịch</Button>
  </form>;
}
function BudgetForm({ onSave }: { onSave: (item: Budget) => void }) { const [name,setName]=useState(''); const [limit,setLimit]=useState(''); return <form onSubmit={(e)=>{e.preventDefault(); if(!name||!limit)return; onSave({id:crypto.randomUUID(),name,limit:Number(limit),spent:0,icon:'🎯',color:'#2c8a54'});}} className="space-y-4"><Field label="Tên danh mục"><input className="field" placeholder="Ví dụ: Sức khỏe" value={name} onChange={(e)=>setName(e.target.value)} required /></Field><Field label="Ngân sách mỗi tháng"><input className="field" type="number" inputMode="numeric" placeholder="0" value={limit} onChange={(e)=>setLimit(e.target.value)} required /></Field><Button type="submit" className="h-11 w-full">Tạo ngân sách</Button></form>; }
function DebtForm({ onSave }: { onSave: (item: Debt) => void }) { const [person,setPerson]=useState(''); const [total,setTotal]=useState(''); const [type,setType]=useState<'owe'|'lend'>('owe'); const [due,setDue]=useState(''); return <form onSubmit={(e)=>{e.preventDefault(); if(!person||!total||!due)return; onSave({id:crypto.randomUUID(),person,total:Number(total),paid:0,type,due:new Date(`${due}T00:00:00`).toLocaleDateString('vi-VN')});}} className="space-y-4"><Field label="Hình thức"><select className="field" value={type} onChange={(e)=>setType(e.target.value as 'owe'|'lend')}><option value="owe">Tôi đang nợ</option><option value="lend">Tôi cho vay</option></select></Field><Field label="Người liên quan"><input className="field" placeholder="Tên người" value={person} onChange={(e)=>setPerson(e.target.value)} required /></Field><Field label="Tổng số tiền"><input className="field" type="number" inputMode="numeric" value={total} onChange={(e)=>setTotal(e.target.value)} required /></Field><Field label="Ngày phải trả"><input className="field" type="date" value={due} onChange={(e)=>setDue(e.target.value)} required /></Field><Button type="submit" className="h-11 w-full">Lưu khoản nợ</Button></form>; }

function MobileNav({ view, pending, onView, onAdd }: { view: View; pending: number; onView: (view: View)=>void; onAdd:()=>void }) { return <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#dfe6e2] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"><MobileItem icon={<Home />} label="Tổng quan" active={view==='overview'} onClick={()=>onView('overview')} /><MobileItem icon={<ScanLine />} label="Giao dịch" active={view==='transactions'} onClick={()=>onView('transactions')} /><button aria-label="Thêm giao dịch" onClick={onAdd} className="mx-auto -mt-6 grid size-14 place-items-center rounded-full border-4 border-[#f5f7f6] bg-[#d8ff62] shadow-lg"><Plus /></button><MobileItem icon={<Inbox />} label="Chờ duyệt" badge={pending} active={view==='pending'} onClick={()=>onView('pending')} /><MobileItem icon={<CircleUserRound />} label="Quản lý" active={['budgets','debts','cards','accounts'].includes(view)} onClick={()=>onView('budgets')} /></nav>; }
function NavItem({icon,label,active,badge,onClick}:{icon:React.ReactNode;label:string;active?:boolean;badge?:number;onClick:()=>void}) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active?'bg-[#eaffaa]':'text-[#5f6e67] hover:bg-[#f2f5f3]'}`}><span className="[&>svg]:size-5">{icon}</span><span className="flex-1 text-left">{label}</span>{badge?<span className="grid size-5 place-items-center rounded-full bg-[#ff665a] text-[10px] text-white">{badge}</span>:null}</button>; }
function MobileItem({icon,label,active,badge,onClick}:{icon:React.ReactNode;label:string;active?:boolean;badge?:number;onClick:()=>void}) { return <button onClick={onClick} className={`relative flex flex-col items-center gap-1 text-[10px] font-semibold ${active?'text-[#17231f]':'text-[#7b8982]'}`}><span className="[&>svg]:size-5">{icon}</span>{label}{badge?<span className="absolute right-[22%] -top-1 grid size-4 place-items-center rounded-full bg-[#ff665a] text-[9px] text-white">{badge}</span>:null}</button>; }
function SectionTitle({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}) { return <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold">{title}</h2>{subtitle&&<p className="mt-.5 text-xs text-[#7b8982]">{subtitle}</p>}</div>{action}</div>; }
function Metric({icon,label,value,positive}:{icon:React.ReactNode;label:string;value:string;positive?:boolean}) { return <div className="flex items-center gap-3"><div className={`grid size-9 place-items-center rounded-xl ${positive?'bg-[#d8ff62] text-[#17231f]':'bg-white/10'}`}>{icon}</div><div><p className="text-xs text-white/55">{label}</p><p className="text-sm font-semibold">{value}</p></div></div>; }
function SummaryCard({icon,label,value,tone}:{icon:React.ReactNode;label:string;value:string;tone:'red'|'green'}) { return <div className={`rounded-[22px] p-5 ${tone==='red'?'bg-[#fff0ed] text-[#7d3028]':'bg-[#eaf7ee] text-[#205f39]'}`}><div className="flex items-center gap-2 text-sm font-semibold">{icon}{label}</div><p className="mt-3 text-2xl font-bold">{value}</p></div>; }
function Info({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#7b8982]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block text-sm font-semibold text-[#435149]">{label}<div className="mt-1.5">{children}</div></label>; }
function Empty({text}:{text:string}) { return <div className="rounded-2xl bg-[#eff8e8] p-5 text-center text-sm font-medium text-[#416324]">{text}</div>; }

function approvePending(id: string, pending: PendingImport[], setPending: React.Dispatch<React.SetStateAction<PendingImport[]>>, setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>, toast: (message:string)=>void) {
  const item=pending.find((entry)=>entry.id===id); if(!item) return; if(!item.category){toast('Vui lòng chọn danh mục trước khi phê duyệt'); return;}
  setTransactions((items)=>[{id:crypto.randomUUID(),icon:item.group==='income'?'💼':'💳',name:item.merchant,category:item.category,time:item.time,amount:cashSignFor(item.group)*item.amount,group:item.group,reporting:reportingBucketFor(item.group,item.category)},...items]); setPending((items)=>items.filter((entry)=>entry.id!==id)); toast(`Đã ghi nhận ${item.merchant} vào ${item.category}`);
}
