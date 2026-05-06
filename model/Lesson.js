const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Lesson must belong to a course'],
    index: true,
  },
  moduleIndex: {
    type: Number,
    default: 0,
  },
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  slug: {
    type: String,
    lowercase: true,
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  type: {
    type: String,
    enum: {
      values: ['video', 'text', 'quiz', 'assignment', 'project', 'live'],
      message: 'Lesson type must be: video, text, quiz, assignment, project, or live',
    },
    default: 'video',
  },
  duration: {
    type: Number,
    default: 0,
  },
  durationFormatted: String,
  videoUrl: String,
  videoProvider: {
    type: String,
    enum: ['cloudinary', 'youtube', 'vimeo', 'other'],
    default: 'cloudinary',
  },
  videoMetadata: {
    publicId: String,
    thumbnailUrl: String,
    streamingUrl: String,
    duration: Number,
    quality: String,
    format: String,
  },
  content: {
    type: String,
  },
  contentFormat: {
    type: String,
    enum: ['markdown', 'html', 'text'],
    default: 'markdown',
  },
  notes: {
    type: String,
  },
  keyPoints: [{
    type: String,
  }],
  resources: [{
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['file', 'link', 'code', 'slides', 'cheatsheet'],
    },
    size: Number,
    format: String,
  }],
  attachments: [{
    name: String,
    url: String,
    publicId: String,
    type: String,
    size: Number,
  }],
  order: {
    type: Number,
    required: true,
    default: 0,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  isMandatory: {
    type: Boolean,
    default: true,
  },
  passingScore: {
    type: Number,
    default: 70,
    min: 0,
    max: 100,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  estimatedTime: {
    type: Number,
    default: 15,
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  completionCriteria: {
    watchPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 90,
    },
    requireInteraction: {
      type: Boolean,
      default: false,
    },
  },
  aiGenerated: {
    type: Boolean,
    default: false,
  },
  aiPrompt: String,
  completionCount: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  averageCompletionTime: {
    type: Number,
    default: 0,
  },
  questions: [{
    question: String,
    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'short_answer', 'coding', 'file_upload'],
      default: 'multiple_choice',
    },
    options: [String],
    correctAnswer: mongoose.Schema.Types.Mixed,
    explanation: String,
    points: {
      type: Number,
      default: 1,
    },
  }],
  settings: {
    autoplay: {
      type: Boolean,
      default: true,
    },
    allowSkip: {
      type: Boolean,
      default: true,
    },
    allowDownload: {
      type: Boolean,
      default: false,
    },
    enableDiscussion: {
      type: Boolean,
      default: true,
    },
    enableNotes: {
      type: Boolean,
      default: true,
    },
    showProgress: {
      type: Boolean,
      default: true,
    },
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  }],
  nextLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  previousLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== INDEXES ====================
lessonSchema.index({ course: 1, order: 1 });
lessonSchema.index({ course: 1, moduleIndex: 1, order: 1 });
lessonSchema.index({ type: 1 });
lessonSchema.index({ isPreview: 1 });
lessonSchema.index({ isPublished: 1 });

// ==================== MIDDLEWARE ====================
lessonSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

lessonSchema.pre('save', function(next) {
  if (this.type === 'video' && this.videoMetadata?.duration) {
    this.duration = this.videoMetadata.duration;
    const hours = Math.floor(this.duration / 3600);
    const minutes = Math.floor((this.duration % 3600) / 60);
    const seconds = this.duration % 60;
    this.durationFormatted = hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
  }
  next();
});

// ==================== METHODS ====================
lessonSchema.methods.incrementViews = async function() {
  this.viewCount += 1;
  await this.save({ validateBeforeSave: false });
};

lessonSchema.methods.incrementCompletions = async function(timeSpent) {
  this.completionCount += 1;
  if (timeSpent) {
    const total = this.averageCompletionTime * (this.completionCount - 1);
    this.averageCompletionTime = Math.round((total + timeSpent) / this.completionCount);
  }
  await this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('Lesson', lessonSchema);
