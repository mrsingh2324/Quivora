const AIJob = require("./AIJob");

async function createAIJob(req, res, next) {
  try {
    const { createdBy, document, inputText, difficulty, questionCount, status, containsQuestions } =
      req.body;

    if (!createdBy || !inputText) {
      return res.status(400).json({
        message: "createdBy and inputText are required",
      });
    }

    const job = await AIJob.create({
      createdBy,
      document,
      inputText,
      difficulty,
      questionCount,
      status,
      containsQuestions,
    });

    return res.status(201).json(job);
  } catch (error) {
    return next(error);
  }
}

async function listAIJobs(_req, res, next) {
  try {
    const jobs = await AIJob.find()
      .populate("createdBy", "name email")
      .populate("document", "title status")
      .populate("resultQuestions", "prompt difficulty")
      .sort({ createdAt: -1 });

    return res.status(200).json(jobs);
  } catch (error) {
    return next(error);
  }
}

async function getAIJobById(req, res, next) {
  try {
    const job = await AIJob.findById(req.params.jobId)
      .populate("createdBy", "name email")
      .populate("document", "title status")
      .populate("resultQuestions", "prompt options difficulty");

    if (!job) {
      return res.status(404).json({ message: "AI job not found" });
    }

    return res.status(200).json(job);
  } catch (error) {
    return next(error);
  }
}

async function updateAIJobStatus(req, res, next) {
  try {
    const { status, containsQuestions, resultQuestions, errorMessage } = req.body;
    const job = await AIJob.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "AI job not found" });
    }

    if (status) {
      job.status = status;
    }
    if (containsQuestions !== undefined) {
      job.containsQuestions = containsQuestions;
    }
    if (resultQuestions) {
      job.resultQuestions = resultQuestions;
    }
    if (errorMessage !== undefined) {
      job.errorMessage = errorMessage;
    }

    await job.save();

    return res.status(200).json(job);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAIJob,
  listAIJobs,
  getAIJobById,
  updateAIJobStatus,
};
