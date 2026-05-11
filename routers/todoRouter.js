import { Router } from "express";
import mongoose from "mongoose";
import Todo from "../models/Todo.js";

const PRIORITIES = new Set(["low", "normal", "high"]);

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { title, description, dueAt, priority } = req.body;
    if (title == null || String(title).trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const todo = await Todo.create({
      title: String(title).trim(),
      ...(description != null && { description: String(description).trim() }),
      ...(dueAt != null && dueAt !== "" && { dueAt: new Date(dueAt) }),
      ...(priority != null && { priority })
    });
    res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 }).lean();
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }

    const { title, description, completed, dueAt, priority } = req.body;
    const patch = {};

    if (title !== undefined) {
      if (String(title).trim() === "") {
        res.status(400).json({ error: "title cannot be empty" });
        return;
      }
      patch.title = String(title).trim();
    }
    if (description !== undefined) {
      patch.description = String(description).trim();
    }
    if (completed !== undefined) {
      if (typeof completed !== "boolean") {
        res.status(400).json({ error: "completed must be a boolean" });
        return;
      }
      patch.completed = completed;
    }
    if (dueAt !== undefined) {
      patch.dueAt =
        dueAt === null || dueAt === "" ? null : new Date(dueAt);
    }
    if (priority !== undefined) {
      if (!PRIORITIES.has(priority)) {
        res.status(400).json({ error: "invalid priority" });
        return;
      }
      patch.priority = priority;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "no fields to update" });
      return;
    }

    const todo = await Todo.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();

    if (!todo) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json(todo);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const deleted = await Todo.findByIdAndDelete(id).lean();
    if (!deleted) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const todo = await Todo.findById(id).lean();
    if (!todo) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

export default router;
