'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, Bell, ChevronDown, CircleUserRound, CreditCard, HandCoins, Home, Inbox, Landmark, LogOut, MailCheck, Pencil, Plus, ScanLine, Search, Settings, Trash2, TrendingDown, TrendingUp, WalletCards, X } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cashSignFor, debtActions, expenseOptions, incomeOptions, reportingBucketFor, type DebtAction, type TransactionGroup } from '@/lib/finance-taxonomy';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type View = 'overview' | 'pending' | 'transactions' | 'accounts' | 'cards' | 'budgets' | 'debts';
type Transaction = { id: string; icon: string; name: string; category: string; time: string; occurredAt?: string; emailId?: string; amount: number; group: TransactionGroup; reporting: 'income' | 'expense' | 'none'; accountId?: string; accountName?: string; destinationAccountId?: string; destinationAccountName?: string; debtAction?: DebtAction; debtId?: string; person?: string; due?: string };
type Budget = { id: string; icon: string; name: string; spent: number; limit: number; color: string; monthKey?: string };
type Debt = { id: string; person: string; type: 'owe' | 'lend'; total: number; paid: number; due: string };
type FinancialAccount = { id: string; name: string; type: 'bank' | 'cash' | 'ewallet'; balance: number; color: string };
type PendingImport = { id: string; bank: string; merchant: string; amount: number; time: string; occurredAt?: string; category: string; group: 'expense' | 'income'; accountId?: string };
type AppData = { transactions: Transaction[]; budgets: Budget[]; debts: Debt[]; accounts: FinancialAccount[]; pending: PendingImport[]; processedEmailIds: string[]; cardBalance: number; cardLimit: number };
type CloudPayload = AppData & { _meta?: { clientId: string; revision: number } };

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
const CREDIT_CARD_ID = 'credit:tpbank-evo';
const CREDIT_CARD_NAME = 'TPBank EVO Visa';
const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const emptyData = (): AppData => ({ transactions: [], budgets: [], debts: [], accounts: [], pending: [], processedEmailIds: [], cardBalance: 0, cardLimit: 0 });
const transactionMonth = (transaction: Transaction) => transaction.occurredAt ? monthKey(new Date(transaction.occurredAt)) : monthKey();
const budgetSpent = (budget: Budget, transactions: Transaction[]) => Math.abs(transactions.filter((transaction) => transaction.reporting === 'expense' && transactionMonth(transaction) === (budget.monthKey ?? monthKey()) && (transaction.category === budget.name || transaction.category.startsWith(`${budget.name} ›`))).reduce((sum, transaction) => sum + transaction.amount, 0));
const cleanLegacyDemoData = (data: Partial<AppData>): Partial<AppData> => {
  const transactions = (data.transactions ?? []).filter((item) => !['t1', 't2', 't3'].includes(item.id));
  const budgets = (data.budgets ?? []).filter((item) => !['b1', 'b2', 'b3'].includes(item.id));
  const debts = (data.debts ?? []).filter((item) => !['d1', 'd2'].includes(item.id));
  const pending = (data.pending ?? []).filter((item) => !['p1', 'p2'].includes(item.id));
  const hadOnlyDemoRecords = transactions.length === 0 && budgets.length === 0 && debts.length === 0 && pending.length === 0;
  return { ...data, transactions, budgets, debts, pending, cardBalance: hadOnlyDemoRecords && data.cardBalance === 8400000 ? 0 : data.cardBalance, cardLimit: hadOnlyDemoRecords && data.cardLimit === 30000000 ? 0 : data.cardLimit };
};

export default function HomePage() {
  const [view, setView] = useState<View>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [processedEmailIds, setProcessedEmailIds] = useState<string[]>([]);
  const [cardBalance, setCardBalance] = useState(0);
  const [cardLimit, setCardLimit] = useState(0);
  const [modal, setModal] = useState<'transaction' | 'budget' | 'debt' | 'account' | null>(null);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'local' | 'error'>('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [authState, setAuthState] = useState<'loading' | 'unconfigured' | 'signed_out' | 'signed_in'>('loading');
  const [gmailBusy, setGmailBusy] = useState(false);
  const clientIdRef = useRef('');
  const revisionRef = useRef(0);
  const suppressNextSaveRef = useRef(false);

  useEffect(() => {
    clientIdRef.current = sessionStorage.getItem('ohbabylovemoney-client-id') || crypto.randomUUID();
    sessionStorage.setItem('ohbabylovemoney-client-id', clientIdRef.current);
    const applyData = (data: Partial<AppData> | null) => {
      const safe = cleanLegacyDemoData(data ?? emptyData());
      setTransactions((safe.transactions ?? []).map((item: Transaction) => ({
        ...item,
        group: item.group ?? (item.amount > 0 ? 'income' : 'expense'),
        reporting: item.reporting ?? (item.amount > 0 ? 'income' : 'expense'),
      })));
      setBudgets(safe.budgets ?? []);
      setDebts(safe.debts ?? []);
      setAccounts(safe.accounts ?? []);
      setPending((safe.pending ?? []).map((item: PendingImport) => ({ ...item, group: item.group ?? 'expense' })));
      setProcessedEmailIds(Array.from(new Set([...(safe.processedEmailIds ?? []), ...(safe.transactions ?? []).flatMap((transaction) => transaction.emailId ? [transaction.emailId] : [])])));
      setCardBalance(typeof safe.cardBalance === 'number' ? safe.cardBalance : 0);
      setCardLimit(typeof safe.cardLimit === 'number' ? safe.cardLimit : 0);
    };

    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        applyData(emptyData());
        setAuthState('unconfigured');
        setSyncStatus('error');
        setReady(true);
        return;
      }

      let localData: AppData | null = null;
      let authenticated = false;
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          applyData(emptyData());
          setAuthState('signed_out');
          setSyncStatus('loading');
          setReady(true);
          return;
        }
        authenticated = true;
        try {
          const saved = localStorage.getItem(`ohbabylovemoney-data-v3:${authData.user.id}`);
          if (saved) localData = JSON.parse(saved);
        } catch { /* bản sao offline của đúng tài khoản */ }
        setAccountId(authData.user.id);
        setAccountEmail(authData.user.email || '');
        const { data: cloud, error: cloudError } = await supabase.from('user_app_state').select('payload').eq('user_id', authData.user.id).maybeSingle();
        if (cloudError) throw cloudError;
        const cloudPayload = cloud?.payload as CloudPayload | undefined;
        revisionRef.current = cloudPayload?._meta?.revision ?? 0;
        suppressNextSaveRef.current = Boolean(cloudPayload);
        applyData(cloudPayload ?? localData ?? emptyData());
        setAuthState('signed_in');
        setSyncStatus('synced');
      } catch {
        applyData(localData ?? emptyData());
        setAuthState(authenticated ? 'signed_in' : 'signed_out');
        setSyncStatus(localData ? 'local' : 'error');
      }
      setReady(true);
    };

    void load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const data = { transactions, budgets, debts, accounts, pending, processedEmailIds, cardBalance, cardLimit };
    if (accountId) localStorage.setItem(`ohbabylovemoney-data-v3:${accountId}`, JSON.stringify(data));
    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || authState !== 'signed_in' || !accountId) return;
      try {
        revisionRef.current += 1;
        const payload: CloudPayload = { ...data, _meta: { clientId: clientIdRef.current, revision: revisionRef.current } };
        const { error } = await supabase.from('user_app_state').upsert({ user_id: accountId, email: accountEmail, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        setSyncStatus('synced');
      } catch {
        setSyncStatus('local');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [ready, authState, accountId, accountEmail, transactions, budgets, debts, accounts, pending, processedEmailIds, cardBalance, cardLimit]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !accountId || authState !== 'signed_in') return;
    const channel = supabase.channel(`user-state:${accountId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_app_state', filter: `user_id=eq.${accountId}` }, (change) => {
      const payload = (change.new as { payload?: CloudPayload }).payload;
      if (!payload) return;
      if (payload._meta?.clientId === clientIdRef.current) return;
      if ((payload._meta?.revision ?? 0) < revisionRef.current) return;
      revisionRef.current = payload._meta?.revision ?? revisionRef.current;
      suppressNextSaveRef.current = true;
      setTransactions(payload.transactions ?? []);
      setBudgets(payload.budgets ?? []);
      setDebts(payload.debts ?? []);
      setAccounts(payload.accounts ?? []);
      setPending(payload.pending ?? []);
      setProcessedEmailIds(payload.processedEmailIds ?? []);
      setCardBalance(payload.cardBalance ?? 0);
      setCardLimit(payload.cardLimit ?? 0);
      setSyncStatus('synced');
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [accountId, authState]);

  const syncGmail = async () => {
    setGmailBusy(true);
    try {
      const response = await fetch('/api/gmail/sync', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không đọc được Gmail');
      const drafts = result.drafts as PendingImport[];
      const knownIds = new Set([...processedEmailIds, ...pending.map((item) => item.id), ...transactions.flatMap((transaction) => transaction.emailId ? [transaction.emailId] : [])]);
      const legacyDuplicates = drafts.filter((draft) => transactions.some((transaction) =>
        transaction.name.trim().toLocaleLowerCase('vi') === draft.merchant.trim().toLocaleLowerCase('vi')
        && Math.abs(transaction.amount) === draft.amount
        && transaction.time === draft.time
      ));
      if (legacyDuplicates.length) setProcessedEmailIds((items) => Array.from(new Set([...items, ...legacyDuplicates.map((draft) => draft.id)])));
      const legacyDuplicateIds = new Set(legacyDuplicates.map((draft) => draft.id));
      const freshDrafts = drafts.filter((draft) => !knownIds.has(draft.id) && !legacyDuplicateIds.has(draft.id));
      setPending((items) => [...freshDrafts, ...items]);
      toast(freshDrafts.length ? `Đã tìm thấy ${freshDrafts.length} email giao dịch mới để chờ duyệt` : 'Không có email giao dịch mới chưa xử lý');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Không thể đồng bộ Gmail');
    } finally {
      setGmailBusy(false);
    }
  };

  const reconnectGmail = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true' },
      },
    });
    if (error) toast(`Không thể cấp lại quyền Gmail: ${error.message}`);
  };

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const applyTransactionEffects = (transaction: Transaction, direction: 1 | -1) => {
    if (transaction.accountId === CREDIT_CARD_ID) setCardBalance((balance) => Math.max(0, balance - transaction.amount * direction));
    else if (transaction.accountId) setAccounts((items) => items.map((account) => account.id === transaction.accountId ? { ...account, balance: account.balance + transaction.amount * direction } : account.id === transaction.destinationAccountId ? { ...account, balance: account.balance - transaction.amount * direction } : account));
    if (transaction.group !== 'debt' || !transaction.debtAction || !transaction.debtId) return;
    if (transaction.debtAction === 'lend' || transaction.debtAction === 'borrow') {
      if (direction === -1) setDebts((items) => items.filter((debt) => debt.id !== transaction.debtId));
      else setDebts((items) => items.some((debt)=>debt.id===transaction.debtId) ? items : [...items,{id:transaction.debtId!,person:transaction.person||'Chưa đặt tên',type:transaction.debtAction==='lend'?'lend':'owe',total:Math.abs(transaction.amount),paid:0,due:transaction.due||'Chưa đặt hạn'}]);
    } else {
      setDebts((items) => items.map((debt) => debt.id === transaction.debtId ? { ...debt, paid: Math.max(0, Math.min(debt.total, debt.paid + direction * Math.abs(transaction.amount))) } : debt));
    }
  };

  const title: Record<View, string> = { overview: 'Tổng quan', pending: 'Giao dịch chờ duyệt', transactions: 'Tất cả giao dịch', accounts: 'Tài khoản của bạn', cards: 'Thẻ tín dụng', budgets: 'Ngân sách theo danh mục', debts: 'Nợ & cho vay' };

  if (authState === 'loading') return <main className="grid min-h-dvh place-items-center bg-[#fffafb]"><Image src="/app-icon.png" alt="OhBabyLoveMoney" width={96} height={96} priority className="size-24 rounded-[26px]" /></main>;
  if (authState === 'signed_out' || authState === 'unconfigured') return <GoogleSignIn configured={authState !== 'unconfigured'} />;

  return (
    <main className="min-h-dvh bg-[#f2f2f7] text-[#1c1c1e]">
      {notice && <div role="status" className="fixed left-1/2 top-4 z-[80] w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-[#17231f] px-4 py-2.5 text-center text-sm font-medium text-white shadow-xl">{notice}</div>}
      <div className="mx-auto grid min-h-dvh max-w-[1480px] grid-cols-1 lg:grid-cols-[250px_1fr]">
        <Sidebar view={view} pending={pending.length} email={accountEmail} onView={setView} onInfo={() => toast(accountEmail || 'Tài khoản Google')} onSignOut={async () => { const supabase = getSupabaseBrowserClient(); await supabase?.auth.signOut(); window.location.assign('/'); }} />
        <section className="min-w-0 pb-24 lg:pb-8">
          <header className="sticky top-0 z-30 flex min-h-16 items-end justify-between border-b border-black/5 bg-white/85 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
            <div><p className="text-xs font-semibold text-[#7b8982]">OhBabyLoveMoney</p><h1 className="text-lg font-bold tracking-tight">{title[view]}</h1></div>
            <div className="flex items-center gap-2">
              <button onClick={() => toast(accountEmail ? `Cloud: ${accountEmail}` : 'Đang dùng bản lưu dự phòng trên thiết bị')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold md:block ${syncStatus === 'synced' ? 'bg-[#eaf7ee] text-[#257545]' : 'bg-[#fff1d7] text-[#7a5410]'}`}>{syncStatus === 'loading' ? 'Đang tải…' : syncStatus === 'synced' ? 'Cloud đã đồng bộ' : 'Đang lưu trên máy'}</button>
              <Button variant="outline" size="icon" aria-label="Tìm kiếm" onClick={() => toast('Tìm kiếm sẽ có ở bản tiếp theo')}><Search /></Button>
              <Button variant="outline" size="icon" aria-label="Thông báo" onClick={() => setView('pending')} className="relative"><Bell />{pending.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#ff665a]" />}</Button>
              <Button data-testid="add-transaction" onClick={() => {setEditingTransaction(null);setModal('transaction');}} className="hidden bg-[#17231f] text-white sm:flex"><Plus /> Thêm giao dịch</Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1120px] px-4 py-5 md:px-8 md:py-7">
            {['budgets', 'debts', 'cards', 'accounts'].includes(view) && <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {([['budgets', 'Ngân sách'], ['debts', 'Nợ & cho vay'], ['cards', 'Thẻ tín dụng'], ['accounts', 'Tài khoản']] as [View, string][]).map(([item, label]) => <button key={item} onClick={() => setView(item)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${view === item ? 'bg-[#17231f] text-white' : 'border border-[#d9dfdc] bg-white text-[#5f6e67]'}`}>{label}</button>)}
            </div>}
            {view === 'overview' && <Overview transactions={transactions} budgets={budgets} accounts={accounts} pending={pending} onView={setView} onApprove={(id) => approvePending(id, pending, accounts, setPending, setTransactions, setAccounts, setCardBalance, setProcessedEmailIds, toast)} />}
            {view === 'transactions' && <TransactionsView transactions={transactions} onEdit={(transaction)=>{setEditingTransaction(transaction);setModal('transaction');}} onDelete={(transaction)=>{if(!window.confirm(`Xoá giao dịch “${transaction.name}”? Số dư liên quan sẽ được hoàn tác.`)) return;applyTransactionEffects(transaction,-1);setTransactions((items)=>items.filter((item)=>item.id!==transaction.id));toast('Đã xoá giao dịch và hoàn tác số dư liên quan');}} />}
            {view === 'pending' && <PendingView pending={pending} accounts={accounts} gmailBusy={gmailBusy} onSyncGmail={syncGmail} onReconnectGmail={reconnectGmail} onGroup={(id, group) => setPending((items) => items.map((item) => item.id === id ? { ...item, group, category: '' } : item))} onCategory={(id, category) => setPending((items) => items.map((item) => item.id === id ? { ...item, category } : item))} onAccount={(id, sourceId) => setPending((items) => items.map((item) => item.id === id ? { ...item, accountId: sourceId } : item))} onApprove={(id) => approvePending(id, pending, accounts, setPending, setTransactions, setAccounts, setCardBalance, setProcessedEmailIds, toast)} onIgnore={(id) => { setProcessedEmailIds((items)=>Array.from(new Set([...items,id]))); setPending((items) => items.filter((item) => item.id !== id)); toast('Đã bỏ qua và đánh dấu email đã xử lý'); }} />}
            {view === 'budgets' && <BudgetsView budgets={budgets} transactions={transactions} onAdd={() => setModal('budget')} onChangeLimit={(id, limit) => setBudgets((items) => items.map((item) => item.id === id ? { ...item, limit } : item))} />}
            {view === 'debts' && <DebtsView debts={debts} onAdd={() => setModal('debt')} onPay={(id, amount) => { setDebts((items) => items.map((item) => item.id === id ? { ...item, paid: Math.min(item.total, item.paid + amount) } : item)); toast('Đã cập nhật tiến độ thanh toán'); }} />}
            {view === 'cards' && <CardsView balance={cardBalance} limit={cardLimit} accounts={accounts} onLimit={setCardLimit} onSettle={(paymentAccountId) => { const paymentAccount=accounts.find((account)=>account.id===paymentAccountId); if(!paymentAccount || cardBalance<=0) return; const paid=cardBalance; setAccounts((items)=>items.map((account)=>account.id===paymentAccountId?{...account,balance:account.balance-paid}:account)); setTransactions((items)=>[{id:crypto.randomUUID(),icon:'💳',name:'Tất toán TPBank EVO Visa',category:'Thanh toán thẻ tín dụng',time:'Vừa xong',amount:-paid,group:'debt',reporting:'none',accountId:paymentAccount.id,accountName:paymentAccount.name,destinationAccountId:CREDIT_CARD_ID,destinationAccountName:CREDIT_CARD_NAME,debtAction:'repay'},...items]); setCardBalance(0); toast(`Đã tất toán từ ${paymentAccount.name}. Hạn mức đã phục hồi.`); }} />}
            {view === 'accounts' && <AccountsView accounts={accounts} onAdd={() => { setEditingAccount(null); setModal('account'); }} onEdit={(account) => { setEditingAccount(account); setModal('account'); }} />}
          </div>
        </section>
      </div>

      <MobileNav view={view} pending={pending.length} onView={setView} onAdd={() => {setEditingTransaction(null);setModal('transaction');}} />
      {modal && <Modal title={modal === 'transaction' ? (editingTransaction?'Sửa giao dịch':'Thêm giao dịch') : modal === 'budget' ? 'Tạo ngân sách danh mục' : modal === 'account' ? (editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản') : 'Thêm khoản nợ / cho vay'} onClose={() => setModal(null)}>
        {modal === 'transaction' && <TransactionForm debts={debts} accounts={accounts} initial={editingTransaction} onSave={(transaction) => {
          if(editingTransaction){applyTransactionEffects(editingTransaction,-1);setTransactions((items)=>items.map((item)=>item.id===editingTransaction.id?transaction:item));}
          else setTransactions((items) => [transaction, ...items]);
          applyTransactionEffects(transaction,1);
          setModal(null); setEditingTransaction(null); toast(editingTransaction ? 'Đã sửa giao dịch và cân đối lại số dư' : transaction.reporting === 'none' ? 'Đã ghi nhận biến động tiền và công nợ' : 'Đã thêm giao dịch mới');
        }} />}
        {modal === 'budget' && <BudgetForm onSave={(budget) => { setBudgets((items) => [...items, budget]); setModal(null); toast('Đã tạo ngân sách danh mục'); }} />}
        {modal === 'debt' && <DebtForm onSave={(debt) => { setDebts((items) => [...items, debt]); setModal(null); toast('Đã thêm khoản nợ'); }} />}
        {modal === 'account' && <AccountForm account={editingAccount} onSave={(account) => { setAccounts((items) => editingAccount ? items.map((item) => item.id === account.id ? account : item) : [...items, account]); setModal(null); setEditingAccount(null); toast(editingAccount ? 'Đã cập nhật số dư tài khoản' : 'Đã thêm tài khoản mới'); }} />}
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
      setErrorMessage(
        'Chưa có cấu hình Supabase trên Vercel.'
      );
      return;
    }

    setBusy(true);
    setErrorMessage('');

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            `${window.location.origin}/auth/callback`,

          scopes:
            'openid email profile https://www.googleapis.com/auth/gmail.readonly',

          queryParams: {
            access_type: 'offline',
            prompt: 'consent select_account',
            include_granted_scopes: 'true',
          },
        },
      });

    if (error) {
      setBusy(false);
      setErrorMessage(
        `Không thể mở đăng nhập Google: ${error.message}`
      );
    }
  };

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const callbackError = params?.get('auth_error');
return <main className="grid min-h-dvh place-items-center bg-[#fffafb] p-5 text-[#17231f]"><section className="w-full max-w-md rounded-[28px] border border-[#f0e1e5] bg-white p-7 text-center shadow-[0_24px_60px_rgba(23,35,31,.10)]"><Image src="/logo-full.png" alt="Oh Baby Love Money" width={280} height={280} priority className="mx-auto h-auto w-[230px]" /><h1 className="mt-2 text-2xl font-bold">Đăng nhập OhBabyLoveMoney</h1><p className="mt-2 text-sm leading-6 text-[#66756e]">Dữ liệu tài chính được tách riêng và đồng bộ theo tài khoản Google của bạn.</p>{(!configured || callbackError || errorMessage) && <div role="alert" className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-left text-xs leading-5 text-[#8b3d34]">{errorMessage || (callbackError === 'oauth' ? 'Google chưa được bật hoặc callback URL chưa đúng trong Supabase.' : callbackError ? 'Cấu hình đăng nhập chưa hoàn tất.' : 'Chưa kết nối Supabase trên Vercel nên Google Login chưa thể hoạt động.')}</div>}<Button onClick={signIn} disabled={busy || !configured} className="mt-6 h-12 w-full bg-[#17231f] text-white"><span className="grid size-6 place-items-center rounded-full bg-white font-bold text-[#4285f4]">G</span>{busy ? 'Đang chuyển đến Google…' : 'Tiếp tục với Google'}</Button>{!configured && <p className="mt-3 text-xs leading-5 text-[#849189]">Cần thêm <code>NEXT_PUBLIC_SUPABASE_URL</code> và <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> trong Vercel rồi Redeploy.</p>}<p className="mt-4 text-xs leading-5 text-[#849189]">Ứng dụng không nhận hoặc lưu mật khẩu Google.</p></section></main>;
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

function Overview({ transactions, budgets, accounts, pending, onView, onApprove }: { transactions: Transaction[]; budgets: Budget[]; accounts: FinancialAccount[]; pending: PendingImport[]; onView: (view: View) => void; onApprove: (id: string) => void }) {
  const now = new Date();
  const expense = Math.abs(transactions.filter((t) => t.reporting === 'expense').reduce((sum, item) => sum + item.amount, 0));
  const income = transactions.filter((t) => t.reporting === 'income').reduce((sum, item) => sum + item.amount, 0);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[26px] bg-[#17231f] p-5 text-white shadow-[0_18px_45px_rgba(23,35,31,.15)] md:p-7">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/60">Tổng số dư các tài khoản</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">{money(totalBalance)}</p></div><Badge className="bg-[#ffb3c1] text-[#14213d]">{accounts.length} nguồn tiền</Badge></div>
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 md:max-w-lg"><Metric icon={<TrendingUp />} label="Thu nhập" value={money(income)} positive /><Metric icon={<TrendingDown />} label="Chi tiêu" value={money(expense)} /></div>
      <div className="mt-6 flex h-12 items-end gap-2">{[32, 54, 38, 70, 47, 84, 64, 92, 75, 100, 86, 72].map((height, index) => <span key={index} className="flex-1 rounded-t bg-[#ff9db2]/80" style={{ height: `${height}%`, opacity: .35 + index / 20 }} />)}</div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.85fr]">
      <div className="space-y-5">
        <section className="surface"><SectionTitle title="Giao dịch chờ duyệt" subtitle="Phải chọn danh mục trước khi ghi nhận" action={<Button variant="ghost" size="sm" onClick={() => onView('pending')}>Xem tất cả</Button>} />
          {pending[0] ? <PendingCard item={pending[0]} compact onCategory={() => onView('pending')} onApprove={() => onApprove(pending[0].id)} onIgnore={() => undefined} /> : <Empty text="Bạn đã xử lý hết email giao dịch." />}
        </section>
        <section className="surface"><SectionTitle title="Giao dịch gần đây" action={<Button variant="ghost" size="sm" onClick={() => onView('transactions')}>Xem tất cả</Button>} /><TransactionList transactions={transactions.slice(0, 4)} /></section>
      </div>
      <div className="space-y-5">
        <section className="surface"><SectionTitle title="Ngân sách danh mục" action={<Button variant="ghost" size="sm" onClick={() => onView('budgets')}>Quản lý</Button>} />{budgets.length ? <div className="space-y-4">{budgets.slice(0, 3).map((budget) => <BudgetRow key={budget.id} budget={budget} spent={budgetSpent(budget, transactions)} />)}</div> : <Empty text="Chưa có ngân sách nào." />}</section>
        <section className="rounded-[22px] bg-[#e9f2ff] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4c6688]">Tổng ngân sách tháng {now.getMonth()+1}</p><p className="mt-2 text-2xl font-bold">{money(budgets.filter((budget)=>!budget.monthKey||budget.monthKey===monthKey(now)).reduce((sum, b) => sum + b.limit, 0))}</p><p className="mt-2 text-xs text-[#4c6688]">Theo dõi riêng từng danh mục để không chi quá tay.</p></section>
      </div>
    </div>
  </div>;
}

function PendingView({ pending, accounts, gmailBusy, onSyncGmail, onReconnectGmail, onGroup, onCategory, onAccount, onApprove, onIgnore }: { pending: PendingImport[]; accounts: FinancialAccount[]; gmailBusy: boolean; onSyncGmail: () => void; onReconnectGmail: () => void; onGroup: (id: string, value: 'expense' | 'income') => void; onCategory: (id: string, value: string) => void; onAccount: (id: string, value: string) => void; onApprove: (id: string) => void; onIgnore: (id: string) => void }) {
  return <div className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-[#d9e7bd] bg-[#f4fae9] p-4 text-sm text-[#405521] sm:flex-row sm:items-center sm:justify-between"><div><strong>Quy tắc an toàn:</strong> Email chỉ tạo bản nháp. Bạn phải chọn nguồn tiền và danh mục trước khi phê duyệt.</div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" onClick={onReconnectGmail} className="bg-white">Cấp lại quyền Gmail</Button><Button variant="outline" onClick={onSyncGmail} disabled={gmailBusy} className="bg-white"><MailCheck />{gmailBusy ? 'Đang đọc Gmail…' : 'Lấy giao dịch từ Gmail'}</Button></div></div>{pending.length ? pending.map((item) => <PendingCard key={item.id} item={item} accounts={accounts} onGroup={(value) => onGroup(item.id, value)} onCategory={(value) => onCategory(item.id, value)} onAccount={(value) => onAccount(item.id, value)} onApprove={() => onApprove(item.id)} onIgnore={() => onIgnore(item.id)} />) : <Empty text="Không còn giao dịch chờ duyệt. Nhấn Lấy giao dịch từ Gmail để kiểm tra email mới." />}</div>;
}

function PendingCard({ item, accounts = [], compact, onGroup, onCategory, onAccount, onApprove, onIgnore }: { item: PendingImport; accounts?: FinancialAccount[]; compact?: boolean; onGroup?: (value: 'expense' | 'income') => void; onCategory: (value: string) => void; onAccount?: (value: string) => void; onApprove: () => void; onIgnore: () => void }) {
  const options = item.group === 'income' ? incomeOptions : expenseOptions;
  return <article className="rounded-2xl border border-[#eadfca] bg-[#fffbf2] p-4" data-testid={`pending-${item.id}`}><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#7d4cff] text-xs font-black text-white">{item.bank.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.merchant}</p><p className="mt-.5 text-xs text-[#7b8982]">{item.bank} · {item.time}</p></div><p className="shrink-0 font-bold">{money(item.amount)}</p></div>{!compact && <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="block text-xs font-semibold text-[#5f6e67]">Nguồn tiền<select aria-label={`Nguồn tiền ${item.merchant}`} value={item.accountId ?? ''} onChange={(e) => onAccount?.(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#d9dfdc] bg-white px-3 text-sm"><option value="">Chọn tài khoản</option><option value={CREDIT_CARD_ID}>{CREDIT_CARD_NAME} · Thẻ tín dụng</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="block text-xs font-semibold text-[#5f6e67]">Loại giao dịch<select aria-label={`Loại ${item.merchant}`} value={item.group} onChange={(e) => onGroup?.(e.target.value as 'expense' | 'income')} className="mt-1.5 h-10 w-full rounded-xl border border-[#d9dfdc] bg-white px-3 text-sm"><option value="expense">Khoản Chi</option><option value="income">Khoản Thu</option></select></label><label className="block text-xs font-semibold text-[#5f6e67]">Danh mục<select aria-label={`Danh mục ${item.merchant}`} value={item.category} onChange={(e) => onCategory(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#d9dfdc] bg-white px-3 text-sm"><option value="">Chọn danh mục</option>{options.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label></div>}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={onApprove}>Phê duyệt</Button>{compact ? <Button size="sm" variant="outline" onClick={() => onCategory('')}>Phân loại</Button> : <Button size="sm" variant="ghost" onClick={onIgnore}>Bỏ qua</Button>}</div></div></div></article>;
}

function BudgetsView({ budgets, transactions, onAdd, onChangeLimit }: { budgets: Budget[]; transactions: Transaction[]; onAdd: () => void; onChangeLimit: (id: string, limit: number) => void }) {
  const now = new Date();
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><p className="text-sm text-[#708078]">Tháng {now.getMonth()+1}/{now.getFullYear()}</p><p className="text-2xl font-bold">{money(budgets.reduce((sum, b) => sum + b.limit, 0))}</p></div><Button onClick={onAdd}><Plus /> Thêm danh mục</Button></div><div className="grid gap-4 md:grid-cols-2">{budgets.map((budget) => <article key={budget.id} className="surface"><BudgetRow budget={budget} spent={budgetSpent(budget, transactions)} /><label className="mt-5 block text-xs font-semibold text-[#5f6e67]">Hạn mức danh mục<input aria-label={`Hạn mức ${budget.name}`} type="number" value={budget.limit} onChange={(e) => onChangeLimit(budget.id, Number(e.target.value))} className="field mt-1.5" /></label></article>)}</div></div>;
}

function BudgetRow({ budget, spent }: { budget: Budget; spent: number }) { const ratio = budget.limit > 0 ? Math.min(100, Math.round(spent / budget.limit * 100)) : 0; return <div><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-lg">{budget.icon}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{budget.name}</p><p className="text-xs font-bold">{ratio}%</p></div><p className="text-xs text-[#7b8982]">{money(spent)} / {money(budget.limit)}</p></div></div><div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className={`h-full rounded-full ${ratio>=100?'bg-[#ff453a]':''}`} style={{ width: `${ratio}%`, background: ratio>=100 ? undefined : budget.color }} /></div></div>; }

function DebtsView({ debts, onAdd, onPay }: { debts: Debt[]; onAdd: () => void; onPay: (id: string, amount: number) => void }) {
  const owe = debts.filter((d) => d.type === 'owe').reduce((s, d) => s + d.total - d.paid, 0); const lend = debts.filter((d) => d.type === 'lend').reduce((s, d) => s + d.total - d.paid, 0);
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><SummaryCard icon={<ArrowUpRight />} label="Bạn còn phải trả" value={money(owe)} tone="red" /><SummaryCard icon={<ArrowDownLeft />} label="Người khác còn nợ bạn" value={money(lend)} tone="green" /></div><div className="flex justify-end"><Button onClick={onAdd}><Plus /> Thêm khoản mới</Button></div><div className="grid gap-4 md:grid-cols-2">{debts.map((debt) => { const remain = debt.total - debt.paid; const ratio = Math.round(debt.paid / debt.total * 100); return <article key={debt.id} className="surface"><div className="flex items-start justify-between"><div><Badge variant="secondary" className={debt.type === 'owe' ? 'bg-[#fff0ed] text-[#a94135]' : 'bg-[#eaf7ee] text-[#257545]'}>{debt.type === 'owe' ? 'Bạn đang nợ' : 'Bạn cho vay'}</Badge><h3 className="mt-3 text-lg font-bold">{debt.person}</h3><p className="text-xs text-[#7b8982]">Hạn trả: {debt.due}</p></div><HandCoins className="size-6 text-[#7b8982]" /></div><div className="mt-5 flex justify-between text-sm"><span>Còn lại</span><strong>{money(remain)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full rounded-full bg-[#7b55c7]" style={{ width: `${ratio}%` }} /></div><p className="mt-2 text-xs text-[#7b8982]">Đã thanh toán {money(debt.paid)} / {money(debt.total)}</p>{remain > 0 ? <Button className="mt-4 w-full" variant="outline" onClick={() => onPay(debt.id, Math.min(500000, remain))}>Ghi nhận trả 500.000 ₫</Button> : <div className="mt-4 rounded-xl bg-[#eaf7ee] p-2.5 text-center text-sm font-semibold text-[#257545]">Đã hoàn tất</div>}</article>; })}</div></div>;
}

function CardsView({ balance, limit, accounts, onLimit, onSettle }: { balance: number; limit: number; accounts: FinancialAccount[]; onLimit: (value: number) => void; onSettle: (paymentAccountId: string) => void }) {
  const available = Math.max(0, limit - balance); const ratio = limit > 0 ? Math.min(100, Math.round(balance / limit * 100)) : 0;
  const [paymentAccountId,setPaymentAccountId]=useState(accounts[0]?.id ?? '');
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-[26px] bg-gradient-to-br from-[#623cc5] to-[#332165] p-6 text-white shadow-xl"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-[.15em] text-white/60">TPBank EVO Visa</p><p className="mt-7 text-2xl font-bold">•••• 1962</p></div><CreditCard className="size-8 text-white/70" /></div><div className="mt-10 grid grid-cols-2 gap-4"><div><p className="text-xs text-white/60">Dư nợ hiện tại</p><p className="font-bold">{money(balance)}</p></div><div><p className="text-xs text-white/60">Hạn mức khả dụng</p><p className="font-bold">{money(available)}</p></div></div></section><section className="surface"><h2 className="font-bold">Chu kỳ thanh toán</h2><div className="mt-4 grid grid-cols-2 gap-3"><Info label="Ngày chốt sao kê" value="Ngày 12 hàng tháng" /><Info label="Ngày đáo hạn" value="Ngày 27 hàng tháng" /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf1ef]"><div className="h-full bg-[#7b55c7]" style={{ width: `${ratio}%` }} /></div><p className="mt-2 text-xs text-[#7b8982]">Đã dùng {ratio}% hạn mức</p><label className="mt-5 block text-xs font-semibold">Hạn mức thẻ<input aria-label="Hạn mức thẻ tín dụng" className="field mt-1.5" type="number" value={limit} onChange={(e) => onLimit(Number(e.target.value))} /></label><label className="mt-4 block text-xs font-semibold">Tất toán từ tài khoản<select aria-label="Tài khoản tất toán thẻ" className="field mt-1.5" value={paymentAccountId} onChange={(event)=>setPaymentAccountId(event.target.value)}><option value="">Chọn nguồn trả thẻ</option>{accounts.map((account)=><option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select></label><Button className="mt-4 w-full" disabled={balance === 0 || !paymentAccountId} onClick={()=>onSettle(paymentAccountId)}>Tất toán dư nợ</Button><p className="mt-2 text-center text-[11px] text-[#7b8982]">Số tiền trả thẻ sẽ được trừ khỏi tài khoản đã chọn và phục hồi hạn mức.</p></section></div>;
}

function AccountsView({ accounts, onAdd, onEdit }: { accounts: FinancialAccount[]; onAdd: () => void; onEdit: (account: FinancialAccount) => void }) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-[#708078]">Tổng số dư do bạn khai báo</p><p className="text-2xl font-bold">{money(total)}</p></div><Button onClick={onAdd}><Plus /> Thêm tài khoản</Button></div>{accounts.length ? <div className="grid gap-4 md:grid-cols-2">{accounts.map((account) => <article key={account.id} className="surface flex items-center gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: account.color }}>{account.type === 'cash' ? <Banknote /> : <Landmark />}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{account.name}</p><p className="text-xs text-[#7b8982]">{account.type === 'cash' ? 'Tiền mặt' : account.type === 'ewallet' ? 'Ví điện tử' : 'Tài khoản ngân hàng'}</p><p className="mt-1 font-bold">{money(account.balance)}</p></div><Button variant="outline" size="icon" aria-label={`Sửa ${account.name}`} onClick={() => onEdit(account)}><Pencil /></Button></article>)}</div> : <div className="surface"><Empty text="Chưa có nguồn tiền. Hãy thêm tài khoản ngân hàng, ví điện tử hoặc tiền mặt." /></div>}</div>;
}
function TransactionsView({ transactions, onEdit, onDelete }: { transactions: Transaction[]; onEdit: (transaction:Transaction)=>void; onDelete:(transaction:Transaction)=>void }) { return <section className="surface"><SectionTitle title={`${transactions.length} giao dịch`} subtitle="Dữ liệu đã được ghi nhận" /><TransactionList transactions={transactions} onEdit={onEdit} onDelete={onDelete} /></section>; }
function TransactionList({ transactions, onEdit, onDelete }: { transactions: Transaction[]; onEdit?: (transaction:Transaction)=>void; onDelete?: (transaction:Transaction)=>void }) { return <div className="divide-y divide-[#edf1ef]">{transactions.map((t) => <div key={t.id} className="flex items-center gap-3 py-3.5"><div className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-lg">{t.icon}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.name}</p><p className="text-xs text-[#7b8982]">{t.category} · {t.accountName || 'Chưa xác định nguồn'}{t.destinationAccountName ? ` ↔ ${t.destinationAccountName}` : ''} · {t.time}</p>{t.reporting === 'none' && <p className="mt-0.5 text-[10px] font-semibold text-[#7b55c7]">Biến động tài sản/công nợ · không tính thu chi</p>}</div><p className={`shrink-0 text-sm font-bold ${t.amount > 0 ? 'text-[#248a4b]' : ''}`}>{t.amount > 0 ? '+ ' : '- '}{money(Math.abs(t.amount))}</p>{onEdit&&onDelete&&<div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label={`Sửa ${t.name}`} onClick={()=>onEdit(t)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Xoá ${t.name}`} className="text-[#d43c32]" onClick={()=>onDelete(t)}><Trash2 /></Button></div>}</div>)}</div>; }

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[94dvh] w-full overflow-auto rounded-t-[32px] bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-6"><div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#d1d1d6] sm:hidden"/><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold tracking-[-.02em]">{title}</h2><Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}><X /></Button></div>{children}</section></div>; }
function TransactionForm({ debts, accounts, initial, onSave }: { debts: Debt[]; accounts: FinancialAccount[]; initial: Transaction | null; onSave: (item: Transaction) => void }) {
  const initialOptions = initial?.group === 'income' ? incomeOptions : expenseOptions;
  const isInitialCustom = Boolean(initial && initial.group !== 'debt' && !initialOptions.some((option) => option.value === initial.category));
  const [name, setName] = useState(initial?.group === 'debt' ? '' : initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : '');
  const [category, setCategory] = useState(isInitialCustom ? '__custom__' : initial?.category ?? expenseOptions[0].value);
  const [customCategory, setCustomCategory] = useState(isInitialCustom ? initial?.category ?? '' : '');
  const [group, setGroup] = useState<TransactionGroup>(initial?.group ?? 'expense');
  const [debtAction, setDebtAction] = useState<DebtAction>(initial?.debtAction ?? 'lend');
  const [person, setPerson] = useState(initial?.person ?? '');
  const [debtId, setDebtId] = useState(initial?.debtId ?? '');
  const [due, setDue] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '');
  const [destinationAccountId, setDestinationAccountId] = useState(initial?.destinationAccountId ?? '');
  const matchingDebts = debts.filter((debt) => debt.total > debt.paid && (debtAction === 'repay' ? debt.type === 'owe' : debt.type === 'lend'));
  const activeDebt = debts.find((debt) => debt.id === debtId);
  const options = (group === 'income' ? incomeOptions : expenseOptions).filter((option) => sourceAccountId !== CREDIT_CARD_ID || (option.value !== 'Tiền chuyển đi' && option.value !== 'Tiền chuyển đến'));

  const changeGroup = (value: TransactionGroup) => {
    setGroup(value);
    setCategory(value === 'income' ? incomeOptions[0].value : expenseOptions[0].value);
    if (value === 'debt' && sourceAccountId === CREDIT_CARD_ID) setSourceAccountId(accounts[0]?.id ?? '');
  };

  return <form onSubmit={(e) => {
    e.preventDefault();
    const isTransfer = sourceAccountId !== CREDIT_CARD_ID && (category === 'Tiền chuyển đi' || category === 'Tiền chuyển đến');
    if (!amount || !sourceAccountId || (isTransfer && (!destinationAccountId || destinationAccountId === sourceAccountId))) return;
    const selectedDebt = activeDebt;
    const actionLabel = debtActions.find((item) => item.value === debtAction)?.label || 'Vay/Nợ';
    const transactionName = group === 'debt' ? `${actionLabel}${selectedDebt ? ` · ${selectedDebt.person}` : person ? ` · ${person}` : ''}` : name;
    if (!transactionName || (group === 'debt' && ['lend', 'borrow'].includes(debtAction) && (!person || (!due && !initial?.due))) || (group === 'debt' && ['repay', 'collect'].includes(debtAction) && !debtId)) return;
    const selectedCategory = group === 'debt' ? actionLabel : category === '__custom__' ? customCategory.trim() : category;
    if (!selectedCategory) return;
    const reporting = reportingBucketFor(group, selectedCategory);
    const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
    const destinationAccount = accounts.find((account) => account.id === destinationAccountId);
    const linkedDebtId = group === 'debt' && ['lend', 'borrow'].includes(debtAction) ? (initial?.debtId ?? crypto.randomUUID()) : debtId || undefined;
    onSave({ id: initial?.id ?? crypto.randomUUID(), icon: group === 'income' ? '💼' : group === 'expense' ? '💳' : '🤝', name: transactionName, category: selectedCategory, time: initial?.time ?? 'Vừa xong', occurredAt: initial?.occurredAt ?? new Date().toISOString(), emailId: initial?.emailId, amount: cashSignFor(group, debtAction) * Number(amount), group, reporting, accountId: sourceAccountId, accountName: sourceAccount?.name ?? (sourceAccountId === CREDIT_CARD_ID ? CREDIT_CARD_NAME : initial?.accountName), destinationAccountId: isTransfer ? destinationAccountId : undefined, destinationAccountName: isTransfer ? destinationAccount?.name : undefined, debtAction: group === 'debt' ? debtAction : undefined, debtId: linkedDebtId, person: person || initial?.person || undefined, due: due ? new Date(`${due}T00:00:00`).toLocaleDateString('vi-VN') : initial?.due });
  }} className="space-y-4">
    <Field label="Loại giao dịch"><select aria-label="Loại giao dịch" className="field" value={group} onChange={(e) => changeGroup(e.target.value as TransactionGroup)}><option value="expense">Khoản Chi</option><option value="income">Khoản Thu</option><option value="debt">Vay/Nợ</option></select></Field>
    <Field label="Ngân hàng / nguồn tiền"><select aria-label="Nguồn tiền giao dịch" className="field" value={sourceAccountId} onChange={(e) => { const value=e.target.value; setSourceAccountId(value); if(value===CREDIT_CARD_ID && (category==='Tiền chuyển đi'||category==='Tiền chuyển đến')) setCategory(group==='income'?'Thu nhập khác':'Chi phí khác'); }} required><option value="">Chọn nguồn tiền</option>{group !== 'debt' && <option value={CREDIT_CARD_ID}>{CREDIT_CARD_NAME} · dư nợ thẻ</option>}{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select>{accounts.length === 0 && group === 'debt' && <p className="mt-2 text-xs font-normal text-[#a34b3f]">Hãy vào mục Tài khoản để thêm ngân hàng, ví hoặc tiền mặt trước.</p>}{sourceAccountId === CREDIT_CARD_ID && <p className="mt-2 text-xs font-normal text-[#6a4aa1]">Khoản chi sẽ tăng dư nợ TPBank EVO; khoản hoàn tiền sẽ giảm dư nợ.</p>}</Field>
    {group !== 'debt' && <><Field label="Nội dung"><input className="field" placeholder={group === 'income' ? 'Ví dụ: Lương tháng 9' : 'Ví dụ: Ăn trưa'} value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="Danh mục"><select aria-label="Danh mục giao dịch" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}<option value="__custom__">＋ Danh mục tùy chỉnh</option></select></Field>{category === '__custom__' && <Field label="Tên danh mục mới"><input aria-label="Tên danh mục mới" className="field" placeholder="Nhập tên danh mục" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} required /></Field>}</>}
    {group === 'debt' && <><Field label="Nghiệp vụ công nợ"><select aria-label="Nghiệp vụ công nợ" className="field" value={debtAction} onChange={(e) => { setDebtAction(e.target.value as DebtAction); setDebtId(''); }}>{debtActions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>{['lend', 'borrow'].includes(debtAction) ? <><Field label="Người liên quan"><input className="field" placeholder="Tên người" value={person} onChange={(e) => setPerson(e.target.value)} required /></Field><Field label="Ngày đến hạn"><input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></Field></> : <Field label={debtAction === 'repay' ? 'Khoản bạn cần trả' : 'Khoản bạn cần thu'}><select aria-label="Khoản công nợ" className="field" value={debtId} onChange={(e) => setDebtId(e.target.value)} required><option value="">Chọn người và khoản nợ</option>{matchingDebts.map((debt) => <option key={debt.id} value={debt.id}>{debt.person} · còn {money(debt.total - debt.paid)}</option>)}</select></Field>}</>}
    {(category === 'Tiền chuyển đi' || category === 'Tiền chuyển đến') && group !== 'debt' && sourceAccountId !== CREDIT_CARD_ID && <Field label="Tài khoản đối ứng"><select aria-label="Tài khoản đối ứng" className="field" value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required><option value="">Chọn tài khoản còn lại</option>{accounts.filter((account) => account.id !== sourceAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>}
    <Field label="Số tiền"><input className="field" type="number" min="1" max={activeDebt ? activeDebt.total - activeDebt.paid : undefined} inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
    {group === 'debt' && <div className="rounded-xl bg-[#f3effc] p-3 text-xs text-[#5c3b91]">{debtAction === 'lend' ? 'Tiền giảm, khoản phải thu tăng. Không tính là chi tiêu.' : debtAction === 'borrow' ? 'Tiền tăng, khoản phải trả tăng. Không tính là thu nhập.' : debtAction === 'repay' ? 'Tiền giảm và khoản phải trả giảm. Không tính là chi tiêu mới.' : 'Tiền tăng và khoản phải thu giảm. Không tính là thu nhập mới.'}</div>}
    {(category === 'Tiền chuyển đi' || category === 'Tiền chuyển đến') && group !== 'debt' && <div className="rounded-xl bg-[#fff7df] p-3 text-xs text-[#735b16]">Chuyển tiền giảm một tài khoản và tăng tài khoản đối ứng cùng số tiền, nên tổng tài sản không đổi và không tính thu chi.</div>}
    <Button type="submit" className="h-12 w-full">{initial ? 'Lưu thay đổi' : 'Lưu giao dịch'}</Button>
  </form>;
}
function AccountForm({ account, onSave }: { account: FinancialAccount | null; onSave: (item: FinancialAccount) => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<FinancialAccount['type']>(account?.type ?? 'bank');
  const [balance, setBalance] = useState(account ? String(account.balance) : '');
  const colors: Record<FinancialAccount['type'], string> = { bank: '#477dd1', cash: '#2c8a54', ewallet: '#d92b72' };
  return <form onSubmit={(event) => { event.preventDefault(); if (!name.trim() || balance === '') return; onSave({ id: account?.id ?? crypto.randomUUID(), name: name.trim(), type, balance: Number(balance), color: account?.color ?? colors[type] }); }} className="space-y-4"><Field label="Loại nguồn tiền"><select className="field" value={type} onChange={(event) => setType(event.target.value as FinancialAccount['type'])}><option value="bank">Tài khoản ngân hàng</option><option value="ewallet">Ví điện tử</option><option value="cash">Tiền mặt</option></select></Field><Field label="Tên tài khoản"><input className="field" placeholder={type === 'cash' ? 'Ví dụ: Tiền mặt' : 'Ví dụ: TPBank thanh toán'} value={name} onChange={(event) => setName(event.target.value)} required /></Field><Field label="Số dư hiện tại"><input className="field" type="number" inputMode="numeric" placeholder="0" value={balance} onChange={(event) => setBalance(event.target.value)} required /><p className="mt-2 text-xs font-normal text-[#7b8982]">Bạn có thể sửa số dư bất kỳ lúc nào để đối soát với ngân hàng thực tế.</p></Field><Button type="submit" className="h-11 w-full">{account ? 'Lưu thay đổi' : 'Thêm nguồn tiền'}</Button></form>;
}
function BudgetForm({ onSave }: { onSave: (item: Budget) => void }) { const [name, setName] = useState(''); const [limit, setLimit] = useState(''); return <form onSubmit={(e) => { e.preventDefault(); if (!name || !limit) return; onSave({ id: crypto.randomUUID(), name, limit: Number(limit), spent: 0, icon: '🎯', color: '#2c8a54', monthKey: monthKey() }); }} className="space-y-4"><Field label="Tên danh mục"><input className="field" placeholder="Ví dụ: Sức khỏe" value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="Ngân sách tháng này"><input className="field" type="number" inputMode="numeric" placeholder="0" value={limit} onChange={(e) => setLimit(e.target.value)} required /></Field><Button type="submit" className="h-11 w-full">Tạo ngân sách</Button></form>; }
function DebtForm({ onSave }: { onSave: (item: Debt) => void }) { const [person, setPerson] = useState(''); const [total, setTotal] = useState(''); const [type, setType] = useState<'owe' | 'lend'>('owe'); const [due, setDue] = useState(''); return <form onSubmit={(e) => { e.preventDefault(); if (!person || !total || !due) return; onSave({ id: crypto.randomUUID(), person, total: Number(total), paid: 0, type, due: new Date(`${due}T00:00:00`).toLocaleDateString('vi-VN') }); }} className="space-y-4"><Field label="Hình thức"><select className="field" value={type} onChange={(e) => setType(e.target.value as 'owe' | 'lend')}><option value="owe">Tôi đang nợ</option><option value="lend">Tôi cho vay</option></select></Field><Field label="Người liên quan"><input className="field" placeholder="Tên người" value={person} onChange={(e) => setPerson(e.target.value)} required /></Field><Field label="Tổng số tiền"><input className="field" type="number" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} required /></Field><Field label="Ngày phải trả"><input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></Field><Button type="submit" className="h-11 w-full">Lưu khoản nợ</Button></form>; }

function MobileNav({ view, pending, onView, onAdd }: { view: View; pending: number; onView: (view: View) => void; onAdd: () => void }) { return <nav className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-[24px] border border-black/5 bg-white/88 px-2 py-2 shadow-[0_10px_35px_rgba(18,32,55,.16)] backdrop-blur-2xl lg:hidden"><MobileItem icon={<Home />} label="Tổng quan" active={view === 'overview'} onClick={() => onView('overview')} /><MobileItem icon={<ScanLine />} label="Giao dịch" active={view === 'transactions'} onClick={() => onView('transactions')} /><button aria-label="Thêm giao dịch" onClick={onAdd} className="mx-auto -mt-5 grid size-14 place-items-center rounded-full border-4 border-[#f2f2f7] bg-[#ff9db2] text-[#0b2351] shadow-[0_8px_22px_rgba(255,110,145,.35)]"><Plus /></button><MobileItem icon={<Inbox />} label="Chờ duyệt" badge={pending} active={view === 'pending'} onClick={() => onView('pending')} /><MobileItem icon={<CircleUserRound />} label="Quản lý" active={['budgets', 'debts', 'cards', 'accounts'].includes(view)} onClick={() => onView('budgets')} /></nav>; }
function NavItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick: () => void }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-[#eaffaa]' : 'text-[#5f6e67] hover:bg-[#f2f5f3]'}`}><span className="[&>svg]:size-5">{icon}</span><span className="flex-1 text-left">{label}</span>{badge ? <span className="grid size-5 place-items-center rounded-full bg-[#ff665a] text-[10px] text-white">{badge}</span> : null}</button>; }
function MobileItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick: () => void }) { return <button onClick={onClick} className={`relative flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? 'text-[#0b2351]' : 'text-[#8e8e93]'}`}><span className="[&>svg]:size-5">{icon}</span>{label}{badge ? <span className="absolute right-[18%] top-0 grid size-4 place-items-center rounded-full bg-[#ff3b30] text-[9px] text-white">{badge}</span> : null}</button>; }
function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) { return <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold">{title}</h2>{subtitle && <p className="mt-.5 text-xs text-[#7b8982]">{subtitle}</p>}</div>{action}</div>; }
function Metric({ icon, label, value, positive }: { icon: React.ReactNode; label: string; value: string; positive?: boolean }) { return <div className="flex items-center gap-3"><div className={`grid size-9 place-items-center rounded-xl ${positive ? 'bg-[#d8ff62] text-[#17231f]' : 'bg-white/10'}`}>{icon}</div><div><p className="text-xs text-white/55">{label}</p><p className="text-sm font-semibold">{value}</p></div></div>; }
function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'red' | 'green' }) { return <div className={`rounded-[22px] p-5 ${tone === 'red' ? 'bg-[#fff0ed] text-[#7d3028]' : 'bg-[#eaf7ee] text-[#205f39]'}`}><div className="flex items-center gap-2 text-sm font-semibold">{icon}{label}</div><p className="mt-3 text-2xl font-bold">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f3f6f4] p-3"><p className="text-[11px] text-[#7b8982]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-[#435149]">{label}<div className="mt-1.5">{children}</div></label>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl bg-[#eff8e8] p-5 text-center text-sm font-medium text-[#416324]">{text}</div>; }

function approvePending(id: string, pending: PendingImport[], accounts: FinancialAccount[], setPending: React.Dispatch<React.SetStateAction<PendingImport[]>>, setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>, setAccounts: React.Dispatch<React.SetStateAction<FinancialAccount[]>>, setCardBalance: React.Dispatch<React.SetStateAction<number>>, setProcessedEmailIds: React.Dispatch<React.SetStateAction<string[]>>, toast: (message: string) => void) {
  const item = pending.find((entry) => entry.id === id); if (!item) return; if (!item.category) { toast('Vui lòng chọn danh mục trước khi phê duyệt'); return; } if (!item.accountId) { toast('Vui lòng chọn ngân hàng hoặc nguồn tiền'); return; }
  const signedAmount = cashSignFor(item.group) * item.amount;
  if (item.accountId === CREDIT_CARD_ID) {
    setTransactions((items) => [{ id: crypto.randomUUID(), icon: '💳', name: item.merchant, category: item.category, time: item.time, occurredAt:item.occurredAt ?? new Date().toISOString(), emailId:item.id, amount: signedAmount, group: item.group, reporting: reportingBucketFor(item.group, item.category), accountId: CREDIT_CARD_ID, accountName: CREDIT_CARD_NAME }, ...items]);
    setCardBalance((balance) => Math.max(0, balance - signedAmount));
    setPending((items) => items.filter((entry) => entry.id !== id));
    setProcessedEmailIds((items)=>Array.from(new Set([...items,id])));
    toast(`Đã ghi nhận ${item.merchant} vào dư nợ ${CREDIT_CARD_NAME}`);
    return;
  }
  const account = accounts.find((entry) => entry.id === item.accountId); if (!account) { toast('Nguồn tiền không còn tồn tại'); return; }
  setTransactions((items) => [{ id: crypto.randomUUID(), icon: item.group === 'income' ? '💼' : '💳', name: item.merchant, category: item.category, time: item.time, occurredAt:item.occurredAt ?? new Date().toISOString(), emailId:item.id, amount: signedAmount, group: item.group, reporting: reportingBucketFor(item.group, item.category), accountId: account.id, accountName: account.name }, ...items]); setAccounts((items) => items.map((entry) => entry.id === account.id ? { ...entry, balance: entry.balance + signedAmount } : entry)); setPending((items) => items.filter((entry) => entry.id !== id)); setProcessedEmailIds((items)=>Array.from(new Set([...items,id]))); toast(`Đã ghi nhận ${item.merchant} vào ${account.name}`);
}
