import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject line is required'],
      trim: true,
    },
    bodyHtml: {
      type: String,
      required: [true, 'Email body is required'],
    },
    category: {
      type: String,
      enum: ['cold-outreach', 'follow-up', 'booking', 're-engagement', 'general'],
      default: 'cold-outreach',
    },
    mergeFields: [
      {
        type: String,
        default: ['firstName', 'lastName', 'company', 'jobTitle', 'website'],
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema);
