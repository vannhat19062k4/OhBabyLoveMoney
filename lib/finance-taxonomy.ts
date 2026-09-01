export type TransactionGroup = 'expense' | 'income' | 'debt';
export type DebtAction = 'lend' | 'repay' | 'collect' | 'borrow';

export type CategoryNode = {
  label: string;
  children?: string[];
};

export const expenseCategories: CategoryNode[] = [
  { label: 'Ăn uống' },
  { label: 'Hóa đơn & tiện ích', children: ['Thuê nhà', 'Hóa đơn tiện ích', 'Hóa đơn internet', 'Hóa đơn khác'] },
  { label: 'Mua sắm', children: ['Đồ dùng cá nhân', 'Đồ gia dụng', 'Làm đẹp'] },
  { label: 'Gia đình', children: ['Sửa & trang trí nhà', 'Dịch vụ gia đình', 'Phụ ba mẹ', 'Từ thiện'] },
  { label: 'Di chuyển', children: ['Bảo dưỡng xe'] },
  { label: 'Sức khỏe', children: ['Thể dục thể thao', 'Khám bệnh'] },
  { label: 'Giáo dục' },
  { label: 'Giải trí', children: ['Dịch vụ trực tuyến', 'Vui chơi'] },
  { label: 'Quà tặng & quyên góp' },
  { label: 'Tiền chuyển đi' },
  { label: 'Trả lãi' },
  { label: 'Chi phí khác' },
];

export const incomeCategories: CategoryNode[] = [
  { label: 'Lương' },
  { label: 'Thu nhập khác' },
  { label: 'Tiền chuyển đến' },
  { label: 'Thu lãi' },
  { label: 'Đầu tư' },
];

export const debtActions: Array<{ value: DebtAction; label: string }> = [
  { value: 'lend', label: 'Cho vay' },
  { value: 'repay', label: 'Trả nợ' },
  { value: 'collect', label: 'Thu nợ' },
  { value: 'borrow', label: 'Đi vay' },
];

export const categoryOptions = (nodes: CategoryNode[]) => nodes.flatMap((node) =>
  node.children?.length
    ? node.children.map((child) => ({ value: `${node.label} › ${child}`, label: `${node.label} › ${child}` }))
    : [{ value: node.label, label: node.label }],
);

export const expenseOptions = categoryOptions(expenseCategories);
export const incomeOptions = categoryOptions(incomeCategories);

export const cashSignFor = (group: TransactionGroup, debtAction?: DebtAction) => {
  if (group === 'expense') return -1;
  if (group === 'income') return 1;
  return debtAction === 'lend' || debtAction === 'repay' ? -1 : 1;
};

export const reportingBucketFor = (group: TransactionGroup, category: string) => {
  if (group === 'debt') return 'none' as const;
  if (category === 'Tiền chuyển đi' || category === 'Tiền chuyển đến') return 'none' as const;
  return group;
};
