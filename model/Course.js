const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [120, 'Title cannot exceed 120 characters'],
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters'],
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Course must have an instructor'],
    index: true,
  },
  coInstructors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'Web Development',
        'AI & Tools',
        'Freelancing',
        'Design',
        'Backend Development',
        'Frontend Development',
        'Data Science',
        'Mobile Development',
        'DevOps',
        'Cybersecurity',
        'Blockchain',
        'Cloud Computing',
        'Digital Marketing',
        'Product Management',
        'UI/UX Design',
        'Other',
      ],
      message: 'Invalid category: {VALUE}',
    },
  },
  subcategory: {
    type: String,
    trim: true,
  },
  level: {
    type: String,
    enum: {
      values: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
      message: 'Level must be: Beginner, Intermediate, Advanced, or All Levels',
    },
    default: 'Beginner',
  },
  language: {
    type: String,
    enum: {
      values: ['English', 'Pidgin English', 'Yoruba', 'Igbo', 'Hausa', 'French'],
      message: 'Invalid language',
    },
    default: 'English',
  },
  thumbnail: {
    type: String,
  },
  promoVideo: {
    type: String,
  },
  trailer: {
    type: String,
  },
  price: {
    type: Number,
    required: [true, 'Course price is required'],
    min: [0, 'Price cannot be negative'],
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative'],
    validate: {
      validator: function(val) {
        return !val || val < this.price;
      },
      message: 'Sale price must be less than regular price',
    },
  },
  saleEndsAt: Date,
  accessType: {
    type: String,
    enum: ['paid', 'free', 'premium'],
    default: 'paid',
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GHS'],
    default: 'NGN',
  },
  learningOutcomes: [{
    type: String,
    required: true,
  }],
  requirements: [{
    type: String,
    required: true,
  }],
  targetAudience: [{
    type: String,
  }],
  syllabus: [{
    moduleTitle: String,
    moduleDescription: String,
    lessons: [{
      title: String,
      type: {
        type: String,
        enum: ['video', 'text', 'quiz', 'assignment', 'project'],
      },
      duration: String,
      isPreview: Boolean,
    }],
  }],
  totalLessons: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: Number,
    default: 0,
  },
  totalQuizzes: {
    type: Number,
    default: 0,
  },
  totalAssignments: {
    type: Number,
    default: 0,
  },
  certificateEnabled: {
    type: Boolean,
    default: true,
  },
  certificateTemplate: {
    type: String,
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'approved', 'rejected', 'suspended', 'archived'],
      message: 'Status must be: draft, pending, approved, rejected, suspended, or archived',
    },
    default: 'draft',
    index: true,
  },
  rejectionReason: {
    type: String,
  },
  rejectionDetails: [{
    reason: String,
    suggestedFix: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  publishedAt: Date,
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  }],
  affiliateProgram: {
    enabled: {
      type: Boolean,
      default: false,
    },
    commissionPercent: {
      type: Number,
      min: [5, 'Minimum commission is 5%'],
      max: [50, 'Maximum commission is 50%'],
      default: 15,
    },
    description: String,
    customCommissionTiers: [{
      minSales: Number,
      commissionPercent: Number,
    }],
  },
  totalStudents: {
    type: Number,
    default: 0,
  },
  activeStudents: {
    type: Number,
    default: 0,
  },
  totalRevenue: {
    type: Number,
    default: 0,
  },
  platformRevenue: {
    type: Number,
    default: 0,
  },
  instructorRevenue: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Rating must be at least 0'],
    max: [5, 'Rating must be at most 5'],
    set: val => Math.round(val * 10) / 10,
  },
  ratingsCount: {
    type: Number,
    default: 0,
  },
  ratingsDistribution: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 },
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    title: String,
    content: String,
    helpful: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    notHelpful: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    instructorResponse: {
      content: String,
      createdAt: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  }],
  coupons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium',
  },
  prerequisites: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
  }],
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isBestseller: {
    type: Boolean,
    default: false,
  },
  isNew: {
    type: Boolean,
    default: true,
  },
  searchKeywords: [{
    type: String,
    trim: true,
  }],
  seoTitle: String,
  seoDescription: String,
  ogImage: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  version: {
    type: Number,
    default: 1,
  },
  approvalHistory: [{
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'suspended', 'unsuspended', 'archived'],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== INDEXES ====================
courseSchema.index({ title: 'text', description: 'text', tags: 'text', searchKeywords: 'text' }, {
  weights: {
    title: 10,
    tags: 8,
    searchKeywords: 6,
    description: 3,
  },
  name: 'course_text_index',
});
courseSchema.index({ category: 1, level: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ averageRating: -1 });
courseSchema.index({ totalStudents: -1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ isFeatured: 1 });
courseSchema.index({ isBestseller: 1 });
courseSchema.index({ 'affiliateProgram.enabled': 1 });
courseSchema.index({ slug: 1 });

// ==================== VIRTUALS ====================
courseSchema.virtual('discountPercent').get(function() {
  if (this.salePrice && this.price > 0) {
    return Math.round((1 - this.salePrice / this.price) * 100);
  }
  return 0;
});

courseSchema.virtual('currentPrice').get(function() {
  if (this.salePrice && (!this.saleEndsAt || this.saleEndsAt > Date.now())) {
    return this.salePrice;
  }
  return this.price;
});

// ==================== MIDDLEWARE ====================
courseSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }
  next();
});

courseSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved') {
    this.approvalHistory.push({
      action: 'approved',
      reason: 'Course approved',
    });
  }
  next();
});

// ==================== METHODS ====================
courseSchema.methods.updateRatings = async function() {
  const stats = await this.model('Review').aggregate([
    { $match: { course: this._id, isHidden: false } },
    {
      $group: {
        _id: '$course',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
        distribution: {
          $push: '$rating',
        },
      },
    },
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].avgRating * 10) / 10;
    this.ratingsCount = stats[0].count;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].distribution.forEach(rating => {
      distribution[rating]++;
    });
    this.ratingsDistribution = distribution;
  }

  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.incrementStudent = async function() {
  this.totalStudents += 1;
  this.activeStudents += 1;
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.addRevenue = async function(amount, platformPercent, instructorPercent) {
  const platformAmount = (amount * platformPercent) / 100;
  const instructorAmount = (amount * instructorPercent) / 100;

  this.totalRevenue += amount;
  this.platformRevenue += platformAmount;
  this.instructorRevenue += instructorAmount;

  await this.save({ validateBeforeSave: false });

  return { platformAmount, instructorAmount };
};

courseSchema.methods.submitForApproval = async function() {
  this.status = 'pending';
  this.approvalHistory.push({
    action: 'submitted',
    reason: 'Course submitted for review',
  });
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.approve = async function(reviewerId) {
  this.status = 'approved';
  this.publishedAt = new Date();
  this.approvalHistory.push({
    action: 'approved',
    performedBy: reviewerId,
    reason: 'Course approved',
  });
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.reject = async function(reviewerId, reason, suggestedFix) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.rejectionDetails.push({
    reason,
    suggestedFix,
  });
  this.approvalHistory.push({
    action: 'rejected',
    performedBy: reviewerId,
    reason,
  });
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.suspend = async function(reviewerId, reason) {
  this.status = 'suspended';
  this.approvalHistory.push({
    action: 'suspended',
    performedBy: reviewerId,
    reason,
  });
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.archive = async function() {
  this.status = 'archived';
  this.approvalHistory.push({
    action: 'archived',
    reason: 'Course archived',
  });
  await this.save({ validateBeforeSave: false });
};

// ==================== PLUGINS ====================
courseSchema.plugin(mongoosePaginate);
courseSchema.plugin(aggregatePaginate);

module.exports = mongoose.model('Course', courseSchema);
