"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(1, "סיסמה נדרשת"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("שגיאה", {
          description: "אימייל או סיסמה שגויים",
        });
      } else {
        router.push("/requests");
        router.refresh();
      }
    } catch {
      toast.error("שגיאה", {
        description: "אירעה שגיאה, נסה שוב",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0F1117" }}
    >
      <Card
        className="w-full max-w-md border"
        style={{
          backgroundColor: "#1A1D27",
          borderColor: "#2D3148",
        }}
      >
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#6B5CF6" }}>
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: "#F1F5F9" }}>
            Domiron
          </CardTitle>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            התחבר לחשבונך
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: "#F1F5F9" }}>
                אימייל
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@domiron.com"
                {...register("email")}
                className="border"
                style={{
                  backgroundColor: "#0F1117",
                  borderColor: "#2D3148",
                  color: "#F1F5F9",
                }}
                dir="ltr"
              />
              {errors.email && (
                <p className="text-sm" style={{ color: "#f87171" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: "#F1F5F9" }}>
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                className="border"
                style={{
                  backgroundColor: "#0F1117",
                  borderColor: "#2D3148",
                  color: "#F1F5F9",
                }}
                dir="ltr"
              />
              {errors.password && (
                <p className="text-sm" style={{ color: "#f87171" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-6 font-semibold"
              disabled={isLoading}
              style={{
                backgroundColor: "#6B5CF6",
                color: "#ffffff",
              }}
            >
              {isLoading ? "מתחבר..." : "התחבר"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
