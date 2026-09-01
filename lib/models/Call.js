import mongoose from 'mongoose';

const CallSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    callSid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'],
      default: 'queued',
      index: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    disposition: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    recordingSid: {
      type: String,
      default: null,
    },
    recordingDuration: {
      type: Number,
      default: 0,
    },
    startTime: { type: Date },
    endTime: { type: Date },
  },
  { timestamps: true }
);

CallSchema.index({ leadId: 1, createdAt: -1 });

export default mongoose.models.Call || mongoose.model('Call', CallSchema);
