const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    account_number: { type: String, required: true, unique: true },
    balance: { type: Number, default: 10000000 }, // Mặc định cấp 10.000.000 VND khi đăng ký
    currency: { type: String, default: 'VND' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);