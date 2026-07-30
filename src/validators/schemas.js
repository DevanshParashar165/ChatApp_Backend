import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    fullname: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    bio: z.string().trim().min(1, "Bio is required").max(200),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      text: z.string().trim().max(5000).optional(),
      image: z.string().optional(),
      audio: z.string().optional(),
      replyTo: z.string().optional(),
    })
    .refine((data) => data.text || data.image || data.audio, {
      message: "Message must contain text, image, or audio",
    }),
});

export const paginationSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({
    cursor: z.string().datetime().optional(),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(parseInt(v, 10) || 30, 50) : 30)),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Search query required").max(100),
    userId: z.string().min(1, "userId is required"),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(parseInt(v, 10) || 20, 50) : 20)),
  }),
});

export const editMessageSchema = z.object({
  params: z.object({
    messageId: z.string().min(1),
  }),
  body: z.object({
    text: z.string().trim().min(1).max(5000),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token required"),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Invalid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});
