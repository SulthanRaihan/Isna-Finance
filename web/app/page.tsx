import { NotebookPen } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">A fresh start</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          Welcome to Isna Finance
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-muted">
          A simpler space for your daily operations, with everything in its
          place.
        </p>
      </div>
      <Card className="mt-8 max-w-3xl gap-4 rounded-[20px] py-8 sm:py-12">
        <CardHeader className="justify-items-center text-center sm:px-8">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-muted text-primary">
            <NotebookPen size={26} aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 className="text-lg leading-7">
              Your workspace is taking shape
            </h2>
          </CardTitle>
          <CardDescription className="max-w-sm">
            Orders, activity, and daily recaps will arrive here as the workspace
            becomes available.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-xs leading-5 text-foreground-muted">
            Preview only · Recording is not available yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
