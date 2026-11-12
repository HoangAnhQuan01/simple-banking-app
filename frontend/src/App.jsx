import { useState, useEffect, useMemo, useCallback } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [account, setAccount] = useState(null);

  // States cho tính năng Chuyển tiền & Lịch sử giao dịch
  const [transactions, setTransactions] = useState([]);
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transferMsg, setTransferMsg] = useState(null);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  // Hàm lấy thông tin tài khoản & lịch sử giao dịch
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Lấy thông tin tài khoản
      const resAcc = await fetch('http://localhost:5000/api/accounts/me', { headers });
      const dataAcc = await resAcc.json();
      if (resAcc.ok) {
        setAccount(dataAcc);
      } else {
        handleLogout();
        return;
      }

      // 2. Lấy lịch sử giao dịch
      const resTx = await fetch('http://localhost:5000/api/accounts/transactions', { headers });
      const dataTx = await resTx.json();
      if (resTx.ok) {
        setTransactions(dataTx);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format số dư VND bằng useMemo
  const formattedBalance = useMemo(() => {
    if (!account) return '0 VND';
    return Number(account.balance).toLocaleString('vi-VN') + ' ' + account.currency;
  }, [account]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setAccount(null);
    setTransactions([]);
  };

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
          to_account_number: toAccount,
          amount: Number(amount),
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setTransferMsg({ type: 'success', text: 'Chuyển tiền thành công!' });
      setToAccount('');
      setAmount('');
      setDescription('');
      fetchData(); // Cập nhật lại số dư & lịch sử giao dịch mới nhất
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
            <p>Số tài khoản: <strong>{account.account_number}</strong></p>
            <p style={{ marginBottom: 0 }}>
              Số dư khả dụng:{' '}
              <strong className="balance-text">{formattedBalance}</strong>
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
                <label>Số tài khoản nhận:</label>
                <input
                  type="text"
                  required
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Số tiền (VND):</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Nội dung chuyển tiền:</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loadingTransfer} className="btn-submit">
                {loadingTransfer ? 'Đang xử lý...' : 'Thực hiện chuyển tiền'}
              </button>
            </form>
          </div>

          {/* Lịch sử giao dịch */}
          <div className="history-box">
            <h3>Lịch sử giao dịch</h3>
            {transactions.length === 0 ? (
              <p style={{ color: '#666' }}>Chưa có giao dịch nào.</p>
            ) : (
              <ul className="history-list">
                {transactions.map((tx) => {
                  const isSender = tx.from_account_id?.account_number === account.account_number;
                  return (
                    <li key={tx._id} className="history-item">
                      <div>
                        <p>
                          {isSender
                            ? `Đến: ${tx.to_account_id?.user_id?.full_name || 'N/A'} (${tx.to_account_id?.account_number || ''})`
                            : `Từ: ${tx.from_account_id?.user_id?.full_name || 'N/A'} (${tx.from_account_id?.account_number || ''})`}
                        </p>
                        <small style={{ color: '#666' }}>{tx.description}</small>
                      </div>
                      <div className={isSender ? 'amount-send' : 'amount-receive'}>
                        {isSender ? '-' : '+'}{Number(tx.amount).toLocaleString('vi-VN')} VND
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