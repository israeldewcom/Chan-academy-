const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: [
      'course_purchase',
      'affiliate_commission',
      'referral_bonus',
      'withdrawal',
      'deposit',
      'refund',
      'payout',
      'subscription',
      'gift',
      'adjustment',
      'platform_fee',
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'reversed'],
    default: 'pending',
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GHS'],
    default: 'NGN',
  },
  fee: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
    required: true,
  },
  balanceBefore: {
    type: Number,
    default: 0,
  },
  balanceAfter: {
    type: Number,
    default: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['paystack', 'stripe', 'wallet', 'bank_transfer', 'card', 'crypto'],
  },
  paymentGateway: {
    type: String,
    enum: ['paystack', 'stripe', 'manual', 'system'],
  },
  gatewayReference: String,
  gatewayResponse: String,
  description: {
    type: String,
    required: true,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
  },
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  affiliateCommission: Number,
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  withdrawalRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalRequest',
  },
  ip: String,
  userAgent: String,
  deviceFingerprint: String,
  isFlagged: {
    type: Boolean,
    default: false,
  },
  flagReason: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,
  completedAt: Date,
  failedAt: Date,
  refundedAt: Date,
  invoice: {
    number: String,
    url: String,
  },
  tags: [String],
}, {
  timestamps: true,
});

// ==================== INDEXES ====================
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 }, { unique: true });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ course: 1 });
transactionSchema.index({ affiliate: 1 });

// ==================== METHODS ====================
transactionSchema.methods.complete = async function(gatewayResponse) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (gatewayResponse) {
    this.gatewayResponse = JSON.stringify(gatewayResponse);
  }
  await this.save();
};

transactionSchema.methods.fail = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.gatewayResponse = reason;
  await this.save();
};

transactionSchema.methods.refund = async function(reason) {
  this.status = 'refunded';
  this.refundedAt = new Date();
  this.description += ` | Refunded: ${reason}`;
  await this.save();
};

// ==================== STATICS ====================
transactionSchema.statics.generateReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CHX-${timestamp}-${random}`;
};

transactionSchema.statics.getUserBalance = async function(userId) {
  const result = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $cond: [{ $in: ['$type', ['course_purchase', 'affiliate_commission', 'referral_bonus', 'deposit', 'refund']] }, '$netAmount', 0],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [{ $in: ['$type', ['withdrawal', 'payout']] }, '$netAmount', 0],
          },
        },
      },
    },
  ]);

  if (result.length === 0) return 0;
  return (result[0].totalCredits - result[0].totalDebits);
};

module.exports = mongoose.model('Transaction', transactionSchema);
