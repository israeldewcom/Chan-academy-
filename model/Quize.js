const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    index: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: String,
  type: {
    type: String,
    enum: ['lesson_quiz', 'section_quiz', 'final_exam', 'practice'],
    default: 'lesson_quiz',
  },
  questions: [{
    question: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'fill_blank', 'matching', 'ordering', 'essay'],
      default: 'multiple_choice',
    },
    options: [{
      text: String,
      isCorrect: Boolean,
      explanation: String,
    }],
    correctAnswer: mongoose.Schema.Types.Mixed,
    explanation: String,
    points: {
      type: Number,
      default: 1,
    },
    timeLimit: {
      type: Number,
      default: 60,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    tags: [String],
    hints: [String],
    order: Number,
  }],
  passingScore: {
    type: Number,
    default: 70,
    min: 0,
    max: 100,
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1,
    max: 10,
  },
  timeLimit: {
    type: Number,
    default: 0,
  },
  shuffleQuestions: {
    type: Boolean,
    default: true,
  },
  shuffleOptions: {
    type: Boolean,
    default: true,
  },
  showResults: {
    type: Boolean,
    default: true,
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true,
  },
  showExplanations: {
    type: Boolean,
    default: true,
  },
  allowRetake: {
    type: Boolean,
    default: true,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  totalQuestions: {
    type: Number,
    default: 0,
  },
  attempts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    score: Number,
    percentage: Number,
    passed: Boolean,
    answers: [{
      questionIndex: Number,
      selectedAnswer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      pointsEarned: Number,
      timeSpent: Number,
    }],
    startedAt: Date,
    completedAt: Date,
    timeSpent: Number,
    attemptNumber: Number,
  }],
  totalAttempts: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  passRate: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// ==================== INDEXES ====================
quizSchema.index({ lesson: 1 });
quizSchema.index({ course: 1, type: 1 });
quizSchema.index({ isPublished: 1 });

// ==================== MIDDLEWARE ====================
quizSchema.pre('save', function(next) {
  this.totalQuestions = this.questions?.length || 0;
  this.totalPoints = this.questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0;
  next();
});

// ==================== METHODS ====================
quizSchema.methods.calculateScore = function(answers) {
  let totalEarned = 0;
  const results = answers.map((answer, index) => {
    const question = this.questions[index];
    if (!question) return { isCorrect: false, pointsEarned: 0 };

    let isCorrect = false;
    switch (question.type) {
      case 'multiple_choice':
        isCorrect = question.options[answer.selectedAnswer]?.isCorrect || false;
        break;
      case 'true_false':
        isCorrect = answer.selectedAnswer === question.correctAnswer;
        break;
      default:
        isCorrect = JSON.stringify(answer.selectedAnswer) === JSON.stringify(question.correctAnswer);
    }

    const pointsEarned = isCorrect ? (question.points || 1) : 0;
    totalEarned += pointsEarned;

    return {
      questionIndex: index,
      selectedAnswer: answer.selectedAnswer,
      isCorrect,
      pointsEarned,
      timeSpent: answer.timeSpent || 0,
    };
  });

  const percentage = (totalEarned / this.totalPoints) * 100;
  const passed = percentage >= this.passingScore;

  return {
    score: totalEarned,
    percentage: Math.round(percentage * 100) / 100,
    passed,
    answers: results,
  };
};

quizSchema.methods.updateStats = async function() {
  const stats = await this.constructor.aggregate([
    { $match: { _id: this._id } },
    { $unwind: '$attempts' },
    {
      $group: {
        _id: '$_id',
        avgScore: { $avg: '$attempts.percentage' },
        totalAttempts: { $sum: 1 },
        passCount: { $sum: { $cond: ['$attempts.passed', 1, 0] } },
      },
    },
  ]);

  if (stats.length > 0) {
    this.averageScore = Math.round(stats[0].avgScore * 100) / 100;
    this.totalAttempts = stats[0].totalAttempts;
    this.passRate = Math.round((stats[0].passCount / stats[0].totalAttempts) * 10000) / 100;
    await this.save({ validateBeforeSave: false });
  }
};

module.exports = mongoose.model('Quiz', quizSchema);
