import { useState, useEffect, useMemo, useCallback } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

// Hàm sinh mã UUID chống trùng lặp giao dịch
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [account, setAccount] = useState(null);

  // States cho Chuyển tiền & Tra cứu người nhận
  const [transactions, setTransactions] = useState([]);
  const [toAccount, setToAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateUUID());
  const [transferMsg, setTransferMsg] = useState(null);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  // States cho Bộ lọc & Tìm kiếm lịch sử giao dịch
  const [filterType, setFilterType] = useState('all'); // 'all' | 'in' | 'out'
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setAccount(null);
    setTransactions([]);
  }, []);

  // Hàm lấy thông tin tài khoản & lịch sử giao dịch
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const resAcc = await fetch('http://localhost:5000/api/accounts/me', { headers });
      const dataAcc = await resAcc.json();
      if (resAcc.ok) {
        setAccount(dataAcc);
      } else {
        handleLogout();
        return;
      }

      const resTx = await fetch('http://localhost:5000/api/accounts/transactions', { headers });
      const dataTx = await resTx.json();
      if (resTx.ok) {
        setTransactions(dataTx);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, handleLogout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tự động tra cứu tên người nhận khi nhập đủ 10 chữ số
  useEffect(() => {
    const cleanAcc = toAccount.trim();
    setRecipientName('');
    setLookupError('');

    if (cleanAcc.length !== 10 || !token) return;

    if (account && cleanAcc === account.account_number) {
      setLookupError('Đây là số tài khoản của chính bạn!');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/accounts/lookup/${cleanAcc}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setRecipientName(data.full_name);
        } else {
          setLookupError(data.message || 'Không tìm thấy tài khoản nhận');
        }
      } catch {
        setLookupError('Không thể tra cứu tài khoản lúc này');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [toAccount, token, account]);

  // Format số dư VND bằng useMemo
  const formattedBalance = useMemo(() => {
    if (!account) return '0 VND';
    return Number(account.balance).toLocaleString('vi-VN') + ' ' + account.currency;
  }, [account]);

  // Lọc danh sách lịch sử giao dịch theo Tab (Tất cả / Tiền vào / Tiền ra) và Ô tìm kiếm
  const filteredTransactions = useMemo(() => {
    if (!account) return [];
    return transactions.filter((tx) => {
      const isSender = tx.from_account_id?.account_number === account.account_number;

      if (filterType === 'out' && !isSender) return false;
      if (filterType === 'in' && isSender) return false;

      if (searchTerm.trim()) {
        const keyword = searchTerm.toLowerCase();
        const partnerName = isSender
          ? tx.to_account_id?.user_id?.full_name || ''
          : tx.from_account_id?.user_id?.full_name || '';
        const partnerAcc = isSender
          ? tx.to_account_id?.account_number || ''
          : tx.from_account_id?.account_number || '';
        const desc = tx.description || '';

        return (
          partnerName.toLowerCase().includes(keyword) ||
          partnerAcc.toLowerCase().includes(keyword) ||
          desc.toLowerCase().includes(keyword)
        );
      }

      return true;
    });
  }, [transactions, account, filterType, searchTerm]);

  // Xử lý gửi form chuyển tiền
  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoadingTransfer(true);
    setTransferMsg(null);

    try {
      const res = await fetch('http://localhost:5000/api/accounts/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to_account_number: toAccount.trim(),
          amount: Number(amount),
          description,
          idempotency_key: idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setTransferMsg({ type: 'success', text: 'Chuyển tiền thành công!' });
      setToAccount('');
      setRecipientName('');
      setAmount('');
      setDescription('');
      setIdempotencyKey(generateUUID()); // Sinh khóa mới cho giao dịch kế tiếp
      fetchData();
    } catch (err) {
      setTransferMsg({ type: 'error', text: err.message });
    } finally {
      setLoadingTransfer(false);
    }
  };

  if (!token) {
    return isRegistering ? (
      <Register onSwitchToLogin={() => setIsRegistering(false)} />
    ) : (
      <Login
        onLoginSuccess={(newToken) => setToken(newToken)}
        onSwitchToRegister={() => setIsRegistering(true)}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h2>Simple Banking App</h2>
        <button onClick={handleLogout} className="btn-logout">
          Đăng xuất
        </button>
      </div>

      {account ? (
        <>
          {/* Thông tin tài khoản */}
          <div className="account-card">
            <h3>Xin chào, {account.full_name}</h3>
            <p style={{ marginTop: 8 }}>Email: {account.email}</p>
            <p>
              Số tài khoản: <strong>{account.account_number}</strong>
            </p>
            <p style={{ marginBottom: 0 }}>
              Số dư khả dụng: <strong className="balance-text">{formattedBalance}</strong>
            </p>
          </div>

          {/* Form Chuyển tiền */}
          <div className="transfer-box">
            <h3>Chuyển tiền nội bộ</h3>
            {transferMsg && (
              <p className={transferMsg.type === 'success' ? 'msg-success' : 'msg-error'}>
                {transferMsg.text}
              </p>
            )}
            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>Số tài khoản nhận (10 chữ số):</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Nhập 10 chữ số tài khoản..."
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                />
                {recipientName && (
                  <small className="lookup-success">
                    Chủ tài khoản nhận: <strong>{recipientName.toUpperCase()}</strong>
                  </small>
                )}
                {lookupError && <small className="lookup-error">{lookupError}</small>}
              </div>

              <div className="form-group">
                <label>Số tiền (VND):</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ví dụ: 500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Nội dung chuyển tiền:</label>
                <input
                  type="text"
                  placeholder="Chuyển tiền nội bộ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loadingTransfer || Boolean(lookupError)}
                className="btn-submit"
              >
                {loadingTransfer ? 'Đang xử lý...' : 'Thực hiện chuyển tiền'}
              </button>
            </form>
          </div>

          {/* Lịch sử giao dịch kèm Bộ lọc & Tìm kiếm */}
          <div className="history-box">
            <h3>Lịch sử giao dịch</h3>

            <div className="filter-bar">
              <div className="filter-tabs">
                <button
                  type="button"
                  className={filterType === 'all' ? 'tab-btn active' : 'tab-btn'}
                  onClick={() => setFilterType('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={filterType === 'in' ? 'tab-btn active' : 'tab-btn'}
                  onClick={() => setFilterType('in')}
                >
                  Tiền vào (+)
                </button>
                <button
                  type="button"
                  className={filterType === 'out' ? 'tab-btn active' : 'tab-btn'}
                  onClick={() => setFilterType('out')}
                >
                  Tiền ra (-)
                </button>
              </div>

              <input
                type="text"
                className="search-input"
                placeholder="Tìm theo tên, số TK, nội dung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {filteredTransactions.length === 0 ? (
              <p style={{ color: '#666' }}>Không có giao dịch nào phù hợp.</p>
            ) : (
              <ul className="history-list">
                {filteredTransactions.map((tx) => {
                  const isSender = tx.from_account_id?.account_number === account.account_number;
                  const timeStr = tx.createdAt
                    ? new Date(tx.createdAt).toLocaleString('vi-VN')
                    : '';
                  return (
                    <li key={tx._id} className="history-item">
                      <div>
                        <p>
                          {isSender
                            ? `Đến: ${tx.to_account_id?.user_id?.full_name || 'N/A'} (${tx.to_account_id?.account_number || ''})`
                            : `Từ: ${tx.from_account_id?.user_id?.full_name || 'N/A'} (${tx.from_account_id?.account_number || ''})`}
                        </p>
                        <small style={{ color: '#666', display: 'block' }}>{tx.description}</small>
                        {timeStr && (
                          <small style={{ color: '#94a3b8', fontSize: 12 }}>{timeStr}</small>
                        )}
                      </div>
                      <div className={isSender ? 'amount-send' : 'amount-receive'}>
                        {isSender ? '-' : '+'}
                        {Number(tx.amount).toLocaleString('vi-VN')} VND
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p style={{ marginTop: 20 }}>Đang tải thông tin tài khoản...</p>
      )}
    </div>
  );
}

export default App;