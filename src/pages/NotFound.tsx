import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="mx-auto mt-16 max-w-sm text-center">
    <Compass className="mx-auto mb-4 h-10 w-10 text-primary/40" />
    <h1 className="text-2xl font-bold">Page not found</h1>
    <p className="mt-1 text-sm text-muted-foreground">That page doesn't exist — it may have moved.</p>
    <Button asChild className="mt-6 h-11">
      <Link to="/">Go to Today</Link>
    </Button>
  </div>
);

export default NotFound;
