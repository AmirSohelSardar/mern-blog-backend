import { supabase, formatUser } from '../config/supabase.js';
import bcryptjs from 'bcryptjs';
import { errorHandler } from '../utils/error.js';
import jwt from 'jsonwebtoken';

export const signup = async (req, res, next) => {
  const { username, email, password } = req.body;

  if (
    !username ||
    !email ||
    !password ||
    username === '' ||
    email === '' ||
    password === ''
  ) {
    return next(errorHandler(400, 'All fields are required'));
  }

  const hashedPassword = bcryptjs.hashSync(password, 10);

  try {
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password: hashedPassword,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return next(errorHandler(400, 'Username or email already exists'));
      }
      throw error;
    }

    res.json('Signup successful');
  } catch (error) {
    next(error);
  }
};

export const signin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password || email === '' || password === '') {
    return next(errorHandler(400, 'All fields are required'));
  }

  try {
    const { data: validUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !validUser) {
      return next(errorHandler(404, 'User not found'));
    }

    const validPassword = bcryptjs.compareSync(password, validUser.password);
    if (!validPassword) {
      return next(errorHandler(400, 'Invalid password'));
    }

    const token = jwt.sign(
      { id: validUser.id, isAdmin: validUser.is_admin },
      process.env.JWT_SECRET
    );

    const { password: pass, ...rest } = validUser;

    const cookieOptions = {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    if (process.env.NODE_ENV === 'production') {
      cookieOptions.sameSite = 'none';
      cookieOptions.secure = true;
    }

    res.status(200).cookie('access_token', token, cookieOptions).json({
      ...rest,
      _id: rest.id,
      isAdmin: rest.is_admin,
      profilePicture: rest.profile_picture,
      authProvider: rest.auth_provider,
      createdAt: rest.created_at,
      updatedAt: rest.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

export const google = async (req, res, next) => {
  const { email, name, googlePhotoUrl } = req.body;

  console.log('🔵 Google OAuth attempt:', { 
    email, 
    name, 
    googlePhotoUrl,
    hasPhoto: !!googlePhotoUrl 
  });

  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (user) {
      console.log('🟡 Existing user found');
      console.log('📸 Current profile_picture in DB:', user.profile_picture);
      
      // Check if user has a custom uploaded photo (from Supabase storage)
      const hasCustomPhoto = user.profile_picture && 
                            user.profile_picture.includes('supabase.co/storage');
      
      console.log('🔍 Has custom uploaded photo:', hasCustomPhoto);
      
      let updateData = {
        auth_provider: 'google',
        updated_at: new Date().toISOString(),
      };
      
      // Only update profile picture if user doesn't have a custom uploaded photo
      if (!hasCustomPhoto) {
        console.log('✅ No custom photo found, updating with Google photo');
        updateData.profile_picture = googlePhotoUrl;
      } else {
        console.log('⚠️ Custom photo exists, keeping it:', user.profile_picture);
      }
      
      // Update user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', email)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Update error:', updateError);
        throw updateError;
      }

      console.log('🟢 User updated in DB:', {
        id: updatedUser.id,
        profile_picture: updatedUser.profile_picture
      });

      const token = jwt.sign(
        { id: updatedUser.id, isAdmin: updatedUser.is_admin },
        process.env.JWT_SECRET
      );
      
      const { password, ...rest } = updatedUser;

      const cookieOptions = {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      if (process.env.NODE_ENV === 'production') {
        cookieOptions.sameSite = 'none';
        cookieOptions.secure = true;
      }

      // Return with proper camelCase formatting
      const responseData = {
        ...rest,
        _id: rest.id,
        isAdmin: rest.is_admin,
        profilePicture: rest.profile_picture,
        authProvider: rest.auth_provider,
        createdAt: rest.created_at,
        updatedAt: rest.updated_at,
      };

      console.log('🟣 Sending response with profilePicture:', responseData.profilePicture);

      return res.status(200).cookie('access_token', token, cookieOptions).json(responseData);
    } else {
      console.log('🟡 New user, creating account');
      
      // Create new user with Google photo
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            username:
              name.toLowerCase().split(' ').join('') +
              Math.random().toString(9).slice(-4),
            email,
            password: hashedPassword,
            profile_picture: googlePhotoUrl,
            auth_provider: 'google',
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        throw insertError;
      }

      console.log('🟢 New user created in DB:', {
        id: newUser.id,
        profile_picture: newUser.profile_picture
      });

      const token = jwt.sign(
        { id: newUser.id, isAdmin: newUser.is_admin },
        process.env.JWT_SECRET
      );
      
      const { password, ...rest } = newUser;

      const cookieOptions = {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      if (process.env.NODE_ENV === 'production') {
        cookieOptions.sameSite = 'none';
        cookieOptions.secure = true;
      }

      // Return with proper camelCase formatting
      const responseData = {
        ...rest,
        _id: rest.id,
        isAdmin: rest.is_admin,
        profilePicture: rest.profile_picture,
        authProvider: rest.auth_provider,
        createdAt: rest.created_at,
        updatedAt: rest.updated_at,
      };

      console.log('🟣 Sending response with profilePicture:', responseData.profilePicture);

      return res.status(200).cookie('access_token', token, cookieOptions).json(responseData);
    }
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    next(error);
  }
};