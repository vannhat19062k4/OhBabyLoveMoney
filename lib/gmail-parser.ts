export type GmailDraft = {
  id: string;
  bank: string;
  merchant: string;
  amount: number;
  time: string;
  occurredAt?: string;
  category: string;
  group: 'expense' | 'income';
};

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: Array<{ name: string; value: string }>;
};

export type GmailMessage = {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function bodyText(payload?: GmailPayload): string {
  if (!payload) return '';
  const own = payload.body?.data && (!payload.mimeType || payload.mimeType.startsWith('text/')) ? decodeBase64Url(payload.body.data) : '';
  return [own, ...(payload.parts ?? []).map(bodyText)].join(' ');
}

function stripMarkup(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function identifyBank(value: string) {
  const text = value.toLowerCase();
  if (/techcombank|\btcb\b/.test(text)) return 'Techcombank';
  if (/vietcombank|vcb digibank|\bvcb\b/.test(text)) return 'Vietcombank';
  if (/tpbank|tp bank|evo/.test(text)) return 'TPBank';
  if (/momo|m_service/.test(text)) return 'MoMo';
  return null;
}

function parseAmount(value: string) {
  const labeled = value.match(/(?:số tiền|so tien|amount|giá trị giao dịch|gia tri giao dich|transaction amount)[^\d]{0,40}([\d][\d.,\s]{2,20})\s*(?:vnd|vnđ|đ|₫)/i);
  const generic = value.match(/([\d][\d.,\s]{2,20})\s*(?:vnd|vnđ|đ|₫)/i) || value.match(/(?:vnd|vnđ|đ|₫)\s*([\d][\d.,\s]{2,20})/i);
  const raw = (labeled?.[1] || generic?.[1] || '').replace(/\D/g, '');
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function inferGroup(value: string): 'expense' | 'income' {
  return /(?:ghi có|ghi co|tiền vào|tien vao|nhận tiền|nhan tien|credited|received|cộng tiền|cong tien)/i.test(value) ? 'income' : 'expense';
}

function inferMerchant(subject: string, text: string, bank: string) {
  const labeled = text.match(/(?:nội dung|noi dung|mô tả|mo ta|merchant|đơn vị chấp nhận thẻ|don vi chap nhan the)\s*[:-]?\s*([^|;]{2,80})/i)?.[1]?.trim();
  if (labeled) return labeled.slice(0, 80);
  return subject.replace(/\[?thông báo\]?|\[?notification\]?/gi, '').trim().slice(0, 80) || `Giao dịch ${bank}`;
}

export function parseGmailTransaction(message: GmailMessage): GmailDraft | null {
  const headers = message.payload?.headers ?? [];
  const subject = headers.find((header) => header.name.toLowerCase() === 'subject')?.value ?? '';
  const from = headers.find((header) => header.name.toLowerCase() === 'from')?.value ?? '';
  const text = stripMarkup(`${subject} ${from} ${message.snippet ?? ''} ${bodyText(message.payload)}`);
  const bank = identifyBank(text);
  const amount = parseAmount(text);
  if (!bank || !amount) return null;
  return {
    id: `gmail:${message.id}`,
    bank,
    merchant: inferMerchant(subject, text, bank),
    amount,
    time: message.internalDate ? new Date(Number(message.internalDate)).toLocaleString('vi-VN') : 'Từ Gmail',
    occurredAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : undefined,
    category: '',
    group: inferGroup(text),
  };
}
