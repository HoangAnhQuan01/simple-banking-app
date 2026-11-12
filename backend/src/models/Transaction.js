const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    from_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    to_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: 'Chuyển tiền nội bộ' },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);