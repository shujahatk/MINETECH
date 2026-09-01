import mongoose from 'mongoose';

const SequenceStepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailTemplate',
    required: true,
  },
  delayDays: { type: Number, default: 2 },
  delayHours: { type: Number, default: 0 },
});

const EmailSequenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sequence name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    steps: [SequenceStepSchema],
    active: {
      type: Boolean,
      default: true,
    },
    stats: {
      enrolledCount: { type: Number, default: 0 },
      activeCount: { type: Number, default: 0 },
      repliedCount: { type: Number, default: 0 },
      completedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.models.EmailSequence || mongoose.model('EmailSequence', EmailSequenceSchema);
