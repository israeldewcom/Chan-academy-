const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const { generateReferralCode } = require('../utils/helpers');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  passwordChangedAt: Date,
  avatar: {
    type: String,
    default: 'default.jpg'
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  location: String,
  website: String,
  skills: [String],
  role: {
    type: String,
    enum: ['student', 'instructor', 'affiliate', 'all'],
    default: 'student'
  },
  roles: [{
    type: String,
    enum: ['student', 'instructor', 'affiliate']
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpires: Date,
  referralCode: {
    type: String,
    unique: true,
    index: true,
    default: function() {
      return generateReferralCode(this.firstName, this.lastName);
    }
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralEarnings: {
    type: Number,
    default: 0
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  streakCount: {
    type: Number,
    default: 0
  },
  lastActiveDate: Date,
  bankAccounts: [{
    bankName: String,
    accountNumber: String,
    accountName: String,
    isDefault: { type: Boolean, default: false },
    verified: { type: Boolean, default: false }
  }],
  payoutMin: {
    type: Number,
    default: 5000
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now }
  }],
  preferences: {
    autoplayNext: { type: Boolean, default: true },
    streakReminder: { type: Boolean, default: true },
    playbackSpeed: { type: Number, default: 1.0 },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    notificationCategories: {
      courseApprovals: { type: Boolean, default: true },
      newAffiliateOffers: { type: Boolean, default: true },
      referralConversions: { type: Boolean, default: true },
      qaReplies: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true }
    }
  },
  enrolledCourses: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    certificateUrl: String,
    lessonsCompleted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    quizScores: [{ quiz: mongoose.Schema.Types.ObjectId, score: Number }],
    lastLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: Date
  }],
  createdCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  affiliateLinks: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    link: String,
    code: String,
    clicks: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    earned: { type: Number, default: 0 }
  }],
  fcmTokens: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ isAdmin: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return verificationToken;
};

module.exports = mongoose.model('User', userSchema);
