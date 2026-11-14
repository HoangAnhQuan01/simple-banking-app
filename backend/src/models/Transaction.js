const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    from_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    to_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: 'Chuyển tiền nội bộ' },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    // Khóa chống trùng lặp giao dịch (Idempotency Key)
    idempotency_key: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);