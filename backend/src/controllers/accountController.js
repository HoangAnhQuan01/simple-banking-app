const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// GET /api/accounts/me - Lấy thông tin tài khoản hiện tại
exports.getMyAccount = async (req, res) => {
  try {
    const account = await Account.findOne({ user_id: req.user.id }).populate(
      'user_id',
      'full_name email status'
    );

    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản ngân hàng!' });
    }

    return res.status(200).json({
      account_number: account.account_number,
      balance: account.balance,
      currency: account.currency,
      full_name: account.user_id.full_name,
      email: account.user_id.email,
    });
  } catch (error) {
    console.error('Get account error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin tài khoản!' });
  }
};

// GET /api/accounts/lookup/:account_number - Tra cứu tên chủ tài khoản nhận
exports.lookupAccount = async (req, res) => {
  try {
    const { account_number } = req.params;
    const account = await Account.findOne({ account_number }).populate('user_id', 'full_name');

    if (!account || !account.user_id) {
      return res.status(404).json({ message: 'Không tìm thấy chủ tài khoản này!' });
    }

    return res.status(200).json({
      account_number: account.account_number,
      full_name: account.user_id.full_name,
    });
  } catch (error) {
    console.error('Lookup account error:', error);
    return res.status(500).json({ message: 'Lỗi khi tra cứu tài khoản!' });
  }
};

// POST /api/accounts/transfer - Chuyển tiền nội bộ
exports.transfer = async (req, res) => {
  try {
    const { to_account_number, amount, description,idempotency_key } = req.body;
    const transferAmount = Number(amount);
    if (!to_account_number || !transferAmount || transferAmount <= 0) {
      return res.status(400).json({ message: 'Số tiền hoặc tài khoản nhận không hợp lệ!' });
    }

    // Kiểm tra chống trùng lặp giao dịch (Idempotency)
    if (idempotency_key) {
      const existingTx = await Transaction.findOne({ idempotency_key });
      if (existingTx) {
        return res.status(409).json({
          message: 'Giao dịch này đã được xử lý trước đó (chống trùng lặp)!',
          transaction: existingTx,
        });
      }
    }

    // 1. Tìm tài khoản người gửi (từ JWT token)
    const fromAccount = await Account.findOne({ user_id: req.user.id });
    if (!fromAccount) {
      return res.status(404).json({ message: 'Tài khoản người gửi không tồn tại!' });
    }

    // 2. Tìm tài khoản người nhận
    const toAccount = await Account.findOne({ account_number: to_account_number });
    if (!toAccount) {
      return res.status(404).json({ message: 'Tài khoản người nhận không tồn tại!' });
    }

    // 3. Kiểm tra chuyển tiền cho chính mình
    if (fromAccount.account_number === toAccount.account_number) {
      return res.status(400).json({ message: 'Không thể tự chuyển tiền cho chính mình!' });
    }

    // 4. Kiểm tra số dư
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ message: 'Số dư không đủ để thực hiện giao dịch!' });
    }

    // 5. Trừ tiền người gửi và cộng tiền người nhận
    fromAccount.balance -= transferAmount;
    toAccount.balance += transferAmount;

    await fromAccount.save();
    await toAccount.save();

    // 6. Ghi nhật ký giao dịch
    const newTransaction = new Transaction({
      from_account_id: fromAccount._id,
      to_account_id: toAccount._id,
      amount: transferAmount,
      description: description || 'Chuyển tiền nội bộ',
      status: 'success',
    });
    await newTransaction.save();

    return res.status(200).json({
      message: 'Chuyển tiền thành công!',
      remaining_balance: fromAccount.balance,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({ message: 'Lỗi server khi chuyển tiền!' });
  }
};

// GET /api/accounts/transactions - Lấy danh sách lịch sử giao dịch
exports.getTransactions = async (req, res) => {
  try {
    const account = await Account.findOne({ user_id: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }

    // Lấy các giao dịch gửi đi hoặc nhận về của tài khoản này
    const transactions = await Transaction.find({
      $or: [{ from_account_id: account._id }, { to_account_id: account._id }],
    })
      .populate({
        path: 'from_account_id',
        select: 'account_number',
        populate: { path: 'user_id', select: 'full_name' },
      })
      .populate({
        path: 'to_account_id',
        select: 'account_number',
        populate: { path: 'user_id', select: 'full_name' },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy lịch sử giao dịch!' });
  }
};