import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    fullName: { type: String, trim: true, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    company: { type: String, trim: true, default: '' },
    jobTitle: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    niche: { type: String, trim: true, default: '' },
    location: {
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      timezone: { type: String, default: 'UTC' },
    },
    status: {
      type: String,
      enum: [
        'NEW',
        'CONTACTED',
        'ENGAGED',
        'INTERESTED',
        'QUALIFIED',
        'CUSTOMER',
        'FOLLOW_UP',
        'NO_RESPONSE',
        'NOT_INTERESTED',
        'DO_NOT_CONTACT',
        // legacy compat
        'new',
        'callback',
        'meeting-booked',
        'not-interested',
        'dnc',
        'opted-out',
      ],
      default: 'NEW',
      index: true,
    },
    tags: [{ type: String, trim: true, index: true }],
    notes: { type: String, default: '' },
    source: { type: String, default: 'manual' },
    customFields: { type: Map, of: String, default: {} },
    suppression: {
      email: { type: Boolean, default: false },
      phone: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      suppressedAt: { type: Date },
    },
    emailSequence: {
      status: { type: String, enum: ['idle', 'active', 'stopped', 'completed'], default: 'idle' },
      sequenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSequence', default: null },
      currentStep: { type: Number, default: 0 },
      nextSendAt: { type: Date, default: null },
      lastSentAt: { type: Date, default: null },
      emailsSent: { type: Number, default: 0 },
      stopReason: { type: String, default: '' },
    },
    lastContactedAt: { type: Date, index: true },
    lastEngagedAt: { type: Date, index: true },
    nextFollowUpAt: { type: Date, index: true },
    hasUnansweredReply: { type: Boolean, default: false, index: true },
    lastReplySnippet: { type: String, default: '' },
    lastReplyChannel: { type: String, default: '' },
    lastReplyAt: { type: Date },
  },
  { timestamps: true }
);

// Helper method before saving to ensure fullName and contact synchronization
LeadSchema.pre('save', function (next) {
  if (!this.fullName && (this.firstName || this.lastName)) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  } else if (this.fullName && !this.firstName && !this.lastName) {
    const parts = this.fullName.split(' ');
    this.firstName = parts[0] || '';
    this.lastName = parts.slice(1).join(' ') || '';
  }
  next();
});

LeadSchema.index({ status: 1, nextFollowUpAt: 1 });
LeadSchema.index({ email: 1, phone: 1 });

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
