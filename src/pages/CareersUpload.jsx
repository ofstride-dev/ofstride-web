import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { resumeUpload, jdUpload, ApiClientError } from "../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function normalizeFileContentType(file) {
  const rawType = String(file?.type || "").toLowerCase();
  const extension = `.${String(file?.name || "").split(".").pop()?.toLowerCase() || ""}`;
  if (ALLOWED_TYPES.includes(rawType)) {
    return rawType;
  }
  if (extension === ".pdf") {
    return "application/pdf";
  }
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return rawType;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function UploadCard({ title, description, uploadFn, invalidTypeMessage }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] ?? null;
    setMessage("");
    setSuccess(false);
    if (!selected) {
      setFile(null);
      return;
    }

    const extension = `.${selected.name.split(".").pop()?.toLowerCase() || ""}`;
    const normalizedType = normalizeFileContentType(selected);
    if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_TYPES.includes(normalizedType)) {
      setMessage(invalidTypeMessage);
      setFile(null);
      return;
    }

    if (selected.size <= 0 || selected.size > MAX_FILE_SIZE) {
      setMessage("File must be under 5 MB.");
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setMessage("");
      const contentBase64 = await readFileAsBase64(file);
      const contentType = normalizeFileContentType(file);

      await uploadFn({
        file_name: file.name,
        file_content_base64: contentBase64,
        content_type: contentType,
      });

      setSuccess(true);
      setMessage("Uploaded successfully!");
      setFile(null);
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof ApiClientError ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">
        <UploadCloud className="w-5 h-5" /> {title}
      </h2>
      <p className="text-sm text-muted mb-4">{description}</p>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm"
            disabled={uploading}
          />
        </div>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {message && (
        <p className={`text-sm mt-3 flex items-center gap-1.5 ${success ? "text-green-600" : "text-amber-600"}`}>
          {success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message}
        </p>
      )}

      <p className="text-xs text-muted mt-3 flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" /> PDF or DOCX, max 5 MB.
      </p>
    </div>
  );
}

function CareersUpload() {
  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <section className="py-14 sm:py-20 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-secondary mb-2">Careers</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">Upload Resume or Job Description</h1>
          <p className="text-text mt-3 max-w-3xl">
            Quickly upload a resume or a job description file. No sign-in, no forms — just pick a file and upload.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-6">
            <UploadCard
              title="Upload Resume"
              description="Upload your resume as a PDF or DOCX file."
              uploadFn={resumeUpload}
              invalidTypeMessage="Only PDF or DOCX resumes are allowed."
            />
            <UploadCard
              title="Upload JD"
              description="Upload a job description file as a PDF or DOCX."
              uploadFn={jdUpload}
              invalidTypeMessage="Only PDF or DOCX job descriptions are allowed."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default CareersUpload;
