import mongoose from 'mongoose';

/**
 * The Note is a free-form canvas of typed elements. Keeping everything in one
 * flexible elements[] array means the frontend can render every element type
 * (text/shape/image/table/sticky) through a single polymorphic renderer.
 */
const elementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // client-generated uuid
    type: {
      type: String,
      enum: ['text', 'shape', 'image', 'table', 'sticky', 'code'],
      required: true,
    },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 100 },
    height: { type: Number, default: 40 },
    rotation: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    style: {
      type: new mongoose.Schema(
        {
          fontFamily: String,
          fontSize: Number,
          color: String,
          backgroundColor: String,
          bold: { type: Boolean, default: false },
          italic: { type: Boolean, default: false },
          underline: { type: Boolean, default: false },
          borderRadius: { type: Number, default: 0 },
          shadow: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: {},
    },
    // polymorphic payload: text string / shape kind / table grid / image url
    content: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled' },
    thumbnail: String, // small preview url, generated client-side on save
    background: { color: { type: String, default: '#ffffff' }, image: String },
    elements: { type: [elementSchema], default: [] },
    pages: { type: Number, default: 3 }, // textbook pages in the notebook
    isPinned: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    // invite-link sharing: a secret code opens the note (role = editor|viewer)
    share: {
      enabled: { type: Boolean, default: false },
      code: { type: String, default: '' },
      role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
      enabledAt: Date,
    },
  },
  { timestamps: true }
);

// one thumbnail shown in the dashboard list — enough for the history view
noteSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Note', noteSchema);