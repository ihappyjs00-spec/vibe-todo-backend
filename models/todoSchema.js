import mongoose from "mongoose";

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },
    completed: {
      type: Boolean,
      default: false
    },
    dueAt: {
      type: Date,
      default: null
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal"
    }
  },
  {
    timestamps: true,
    collection: "todos"
  }
);

todoSchema.index({ createdAt: -1 });
todoSchema.index({ completed: 1, createdAt: -1 });

export default todoSchema;
