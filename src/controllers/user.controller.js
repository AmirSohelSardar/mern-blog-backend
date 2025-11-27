import bcryptjs from 'bcryptjs';
import { errorHandler } from '../utils/error.js';
import { supabase } from '../config/supabase.js';

export const test = (req, res) => {
  res.json({ message: 'API is working!' });
};

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.userId) {
    return next(errorHandler(403, 'You are not allowed to update this user'));
  }

  try {
    // ✅ First, get the user's auth provider
    const { data: currentUserData } = await supabase
      .from('users')
      .select('auth_provider')
      .eq('id', req.params.userId)
      .single();

    const updates = {};

    // ✅ BLOCK password update for Google users
    if (req.body.password) {
      if (currentUserData?.auth_provider === 'google') {
        return next(
          errorHandler(400, 'Cannot update password for Google accounts')
        );
      }
      if (req.body.password.length < 6) {
        return next(errorHandler(400, 'Password must be at least 6 characters'));
      }
      updates.password = bcryptjs.hashSync(req.body.password, 10);
    }

    if (req.body.username) {
      if (req.body.username.length < 7 || req.body.username.length > 20) {
        return next(
          errorHandler(400, 'Username must be between 7 and 20 characters')
        );
      }
      if (req.body.username.includes(' ')) {
        return next(errorHandler(400, 'Username cannot contain spaces'));
      }
      if (req.body.username !== req.body.username.toLowerCase()) {
        return next(errorHandler(400, 'Username must be lowercase'));
      }
      if (!req.body.username.match(/^[a-zA-Z0-9]+$/)) {
        return next(
          errorHandler(400, 'Username can only contain letters and numbers')
        );
      }
      updates.username = req.body.username;
    }

    if (req.body.email) {
      updates.email = req.body.email;
    }

    if (req.body.profilePicture) {
      updates.profile_picture = req.body.profilePicture;
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.userId)
      .select()
      .single();

    if (error) throw error;

    const { password, ...rest } = updatedUser;
    res.status(200).json({
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

export const deleteUser = async (req, res, next) => {
  if (!req.user.isAdmin && req.user.id !== req.params.userId) {
    return next(errorHandler(403, 'You are not allowed to delete this user'));
  }

  try {
    // Get user data first to find their profile picture
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('profile_picture')
      .eq('id', req.params.userId)
      .single();

    if (fetchError) throw fetchError;

    // Delete profile picture from storage if it exists and is not a Google profile
    if (user?.profile_picture && !user.profile_picture.includes('googleusercontent.com')) {
      // Extract the file path from the URL
      const urlParts = user.profile_picture.split('/profile-pictures/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        
        await supabase.storage
          .from('posts')
          .remove([`profile-pictures/${filePath}`]);
      }
    }

    // Delete user from database
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.userId);

    if (error) throw error;

    res.status(200).json('User has been deleted');
  } catch (error) {
    next(error);
  }
};

export const signout = (req, res, next) => {
  try {
    res
      .clearCookie('access_token')
      .status(200)
      .json('User has been signed out');
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, 'You are not allowed to see all users'));
  }

  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === 'asc' ? 'asc' : 'desc';

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: sortDirection === 'asc' })
      .range(startIndex, startIndex + limit - 1);

    if (error) throw error;

    const usersWithoutPassword = users.map((user) => {
      const { password, ...rest } = user;
      return {
        ...rest,
        _id: rest.id,
        isAdmin: rest.is_admin,
        profilePicture: rest.profile_picture,
        authProvider: rest.auth_provider,
        createdAt: rest.created_at,
        updatedAt: rest.updated_at,
      };
    });

    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );

    const { count: lastMonthUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneMonthAgo.toISOString());

    res.status(200).json({
      users: usersWithoutPassword,
      totalUsers,
      lastMonthUsers,
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    if (error || !user) {
      return next(errorHandler(404, 'User not found'));
    }

    const { password, ...rest } = user;
    res.status(200).json({
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