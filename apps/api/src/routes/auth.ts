import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '@chat/database';
import { createUserSchema, loginSchema } from '@chat/shared';
import { config } from '../config';
import { authRateLimiter } from '../middleware/rateLimiter';
import type { ApiResponse, SessionUser } from '@chat/shared';

const router = Router();

// Register
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const input = createUserSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: 'User already exists' },
      } as ApiResponse);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
      },
    });

    // Generate token
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    const token = jwt.sign(sessionUser, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);

    res.json({
      success: true,
      data: { user: sessionUser, token },
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Registration failed' },
    } as ApiResponse);
  }
});

// Login
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' },
      } as ApiResponse);
    }

    // Verify password
    const valid = await bcrypt.compare(input.password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' },
      } as ApiResponse);
    }

    // Generate token
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    const token = jwt.sign(sessionUser, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);

    res.json({
      success: true,
      data: { user: sessionUser, token },
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Login failed' },
    } as ApiResponse);
  }
});

export default router;

