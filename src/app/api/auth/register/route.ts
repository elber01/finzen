import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, ensureDb } from '@/lib/db';
import { DEFAULT_CATEGORIES } from '@/lib/finzen/default-categories';

export async function POST(req: Request) {
  try {
    // Ensure DB schema is initialized (Vercel serverless cold start)
    await ensureDb();
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        passwordHash,
      },
    });

    // Seed default categories for this user
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const cat = DEFAULT_CATEGORIES[i];
      await db.category.create({
        data: {
          userId: user.id,
          name: cat.name,
          nameEs: cat.nameEs,
          nameEn: cat.nameEn,
          icon: cat.icon,
          color: cat.color,
          direction: cat.direction,
          isSystem: true,
          sortOrder: i,
        },
      });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
