'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  UserPlus,
  Search,
  Phone,
  Send,
  X,
  CheckCircle2,
  MessageCircle,
  History,
  Copy,
} from 'lucide-react';
import { Customer, UdhaarTransaction, UdhaarType } from '../../types';
import { formatCurrency, formatRelativeDate, formatDate, useIsMounted } from '../../lib/formatters';
import { addCustomer, recordUdhaarTransaction } from '../../lib/storage';

interface UdhaarTabProps {
  customers: Customer[];
  transactions: UdhaarTransaction[];
  shopName: string;
  onRefresh: () => void;
}

export const UdhaarTab: React.FC<UdhaarTabProps> = ({
  customers,
  transactions,
  shopName,
  onRefresh,
}) => {
  const isMounted = useIsMounted();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'settled'>('all');

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedCustomerForTx, setSelectedCustomerForTx] = useState<{
    customer: Customer;
    defaultType: UdhaarType;
  } | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [reminderMessage, setReminderMessage] = useState<{
    customer: Customer;
    message: string;
  } | null>(null);

  // New Customer Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Transaction Form State
  const [txType, setTxType] = useState<UdhaarType>('credit_given');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  // Copy Alert
  const [copySuccess, setCopySuccess] = useState(false);

  // Submission Locks
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const isSubmittingCustRef = useRef(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const isSubmittingTxRef = useRef(false);

  // Calculations
  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  }, [customers]);

  const pendingCustomersCount = useMemo(() => {
    return customers.filter((c) => c.currentBalance > 0).length;
  }, [customers]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterType === 'pending') return c.currentBalance > 0;
      if (filterType === 'settled') return c.currentBalance <= 0;

      return true;
    });
  }, [customers, searchTerm, filterType]);

  // Submit Add Customer
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCustRef.current || isSubmittingCust) return;

    const trimmed = customerName.trim();
    if (!trimmed) {
      setFormError('Customer name is required');
      return;
    }

    const isDuplicate = customers.some(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setFormError(`Customer "${trimmed}" already exists.`);
      return;
    }

    const initBal = parseFloat(initialBalance);
    if (!isNaN(initBal) && initBal < 0) {
      setFormError('Opening balance cannot be negative.');
      return;
    }

    isSubmittingCustRef.current = true;
    setIsSubmittingCust(true);
    try {
      const res = addCustomer({
        name: trimmed,
        phone: customerPhone,
        address: customerAddress,
        initialBalance: isNaN(initBal) ? 0 : initBal,
      });

      if (!res.success) {
        setFormError(res.error || 'Could not add customer');
        return;
      }

      // Reset
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setInitialBalance('');
      setIsAddCustomerOpen(false);
      setFormError(null);
      onRefresh();
    } finally {
      isSubmittingCustRef.current = false;
      setIsSubmittingCust(false);
    }
  };

  // Submit Udhaar / Jama Transaction
  const handleRecordTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTxRef.current || isSubmittingTx) return;
    if (!selectedCustomerForTx) return;

    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) {
      setTxError('Amount must be greater than 0');
      return;
    }

    isSubmittingTxRef.current = true;
    setIsSubmittingTx(true);
    try {
      const res = recordUdhaarTransaction({
        customerId: selectedCustomerForTx.customer.id,
        type: txType,
        amount: amt,
        notes: txNotes.trim() || undefined,
      });

      if (!res.success) {
        setTxError(res.error || 'Could not record transaction');
        return;
      }

      // Reset & Close
      setSelectedCustomerForTx(null);
      setTxAmount('');
      setTxNotes('');
      setTxError(null);
      onRefresh();
    } finally {
      isSubmittingTxRef.current = false;
      setIsSubmittingTx(false);
    }
  };

  // Generate WhatsApp Reminder
  const handleGenerateReminder = (cust: Customer) => {
    const text = `नमस्ते ${cust.name} जी! 🙏\n\nआपकी दुकान (${shopName || 'Dukaan Sathi'}) का बाकी उधार ₹${cust.currentBalance} है।\nकृपया सुविधानुसार जल्द भुगतान करें या UPI पर ट्रांसफर कर दें। धन्यवाद! 😊`;
    setReminderMessage({
      customer: cust,
      message: text,
    });
    setCopySuccess(false);
  };

  const handleCopyMessage = () => {
    if (!reminderMessage) return;
    navigator.clipboard.writeText(reminderMessage.message);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Customer Credit Ledger (Udhaar Register)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Customer ledger, credit given, payments received, and WhatsApp reminders
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsAddCustomerOpen(true);
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* KPI Cards for Udhaar */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-red-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Outstanding Credit
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-red-600 mt-2">
            {formatCurrency(totalOutstanding)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {pendingCustomersCount} {pendingCustomersCount === 1 ? 'customer has' : 'customers have'} pending balance
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Registered Customers
          </div>
          <div className="text-xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {customers.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {customers.length - pendingCustomersCount} accounts settled
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, mobile number, or address..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterType('pending')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterType === 'pending'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-900 hover:bg-red-200'
            }`}
          >
            Pending ({pendingCustomersCount})
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterType === 'settled'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
            }`}
          >
            Settled ({customers.length - pendingCustomersCount})
          </button>
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-base">No customers found</h3>
          <p className="text-xs text-slate-500 mt-1">Click the button above to add a new customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredCustomers.map((cust) => {
            const hasDue = cust.currentBalance > 0;

            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {cust.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {cust.phone}
                        </span>
                        {cust.address && <span>• {cust.address}</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium">Outstanding Balance</div>
                      <div
                        className={`text-lg sm:text-xl font-extrabold ${
                          hasDue ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {formatCurrency(cust.currentBalance)}
                      </div>
                    </div>
                  </div>

                  {cust.lastTransactionAt && (
                    <div className="mt-2 text-[11px] text-slate-400" suppressHydrationWarning>
                      Last transaction: {isMounted ? formatRelativeDate(cust.lastTransactionAt) : formatDate(cust.lastTransactionAt)}
                    </div>
                  )}
                </div>

                {/* Quick Actions for this customer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                  {/* Action 1: Udhaar Diya (-) */}
                  <button
                    onClick={() => {
                      setSelectedCustomerForTx({
                        customer: cust,
                        defaultType: 'credit_given',
                      });
                      setTxType('credit_given');
                      setTxAmount('');
                      setTxNotes('');
                      setTxError(null);
                    }}
                    className="flex-1 py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 transition-colors text-center"
                  >
                    + Give Credit
                  </button>

                  {/* Action 2: Jama Mila (+) */}
                  <button
                    onClick={() => {
                      setSelectedCustomerForTx({
                        customer: cust,
                        defaultType: 'payment_received',
                      });
                      setTxType('payment_received');
                      setTxAmount('');
                      setTxNotes('');
                      setTxError(null);
                    }}
                    className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition-colors text-center"
                  >
                    + Payment Received
                  </button>

                  {/* Action 3: Ledger View */}
                  <button
                    onClick={() => setLedgerCustomer(cust)}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                    title="Customer Ledger"
                  >
                    <History className="w-3.5 h-3.5 inline mr-1" />
                    Ledger
                  </button>

                  {/* Action 4: WhatsApp Reminder */}
                  {hasDue && (
                    <button
                      onClick={() => handleGenerateReminder(cust)}
                      className="py-1.5 px-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-colors"
                      title="WhatsApp Reminder"
                    >
                      <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                      Reminder
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Udhaar / Payment Transaction Modal */}
      {selectedCustomerForTx && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedCustomerForTx.customer.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Current Balance:{' '}
                  <span className="font-bold text-red-600">
                    {formatCurrency(selectedCustomerForTx.customer.currentBalance)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTx} className="mt-4 space-y-3.5">
              {txError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {txError}
                </div>
              )}

              {/* Transaction Type Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('credit_given')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    txType === 'credit_given'
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Give Credit (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('payment_received')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    txType === 'payment_received'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Payment Received (-)
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="₹ 500"
                  className="w-full px-3.5 py-2 text-base font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Items (Optional)
                </label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder={
                    txType === 'credit_given'
                      ? 'e.g. 2 kg Sugar, Cooking Oil'
                      : 'e.g. Cash payment received'
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForTx(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors ${
                    isSubmittingTx
                      ? 'bg-slate-400 cursor-not-allowed opacity-75'
                      : txType === 'credit_given'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmittingTx
                    ? 'Saving...'
                    : txType === 'credit_given'
                    ? 'Record Credit'
                    : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Add New Customer Account
              </h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="mt-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar, Sharma Ji"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address / Landmark
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Lane 4, Near School"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Opening Balance (₹, if any)
                </label>
                <input
                  type="number"
                  step="any"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors ${
                    isSubmittingCust
                      ? 'bg-slate-400 cursor-not-allowed opacity-75'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmittingCust ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger History Modal */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  {ledgerCustomer.name}&apos;s Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  Current Balance:{' '}
                  <span className="font-bold text-red-600">
                    {formatCurrency(ledgerCustomer.currentBalance)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setLedgerCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-slate-100 pr-1">
              {transactions.filter((t) => t.customerId === ledgerCustomer.id).length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No transaction history for this customer.
                </p>
              ) : (
                transactions
                  .filter((t) => t.customerId === ledgerCustomer.id)
                  .map((t) => {
                    const isCredit = t.type === 'credit_given';
                    return (
                      <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                isCredit
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isCredit ? 'Credit Given' : 'Payment Received'}
                            </span>
                            <span className="text-xs text-slate-700 font-medium">{t.notes}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(t.createdAt)}
                          </div>
                        </div>

                        <div
                          className={`font-bold text-sm ${
                            isCredit ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {isCredit ? `+ ${formatCurrency(t.amount)}` : `- ${formatCurrency(t.amount)}`}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setLedgerCustomer(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Reminder Text Modal */}
      {reminderMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">WhatsApp Payment Reminder</h3>
              </div>
              <button
                onClick={() => setReminderMessage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Generated Message:
              </label>
              <textarea
                rows={5}
                readOnly
                value={reminderMessage.message}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCopyMessage}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>

              {reminderMessage.customer.phone && (
                <a
                  href={`https://wa.me/91${reminderMessage.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    reminderMessage.message
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
