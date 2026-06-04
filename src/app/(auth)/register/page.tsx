import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthForm } from "@/components/auth/auth-form"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export const metadata = { title: "Register" }

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Restricted Registration</p>
                <p className="mt-1 text-xs">
                  Only authorized email addresses can create accounts. 
                  Contact an administrator if you need access.
                </p>
              </div>
            </div>
          </div>
          <AuthForm type="register" />
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}