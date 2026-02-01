const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeletedUser = require('../models/DeletedUser');

const router = express.Router();

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'toolhub-secret-key-change-in-production');
        const user = await User.findById(decoded.id);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Get all users with search, filter, sort, pagination (admin only)
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const {
            search = '',
            status = '',
            role = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        // Build query
        const query = {};

        // Search by username or email
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status && ['active', 'suspended', 'pending'].includes(status)) {
            query.status = status;
        }

        // Filter by role
        if (role && ['user', 'admin'].includes(role)) {
            query.role = role;
        }

        // Calculate pagination
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get total count for pagination
        const total = await User.countDocuments(query);

        // Get users
        const users = await User.find(query)
            .select('-password')
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        res.json({
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get user count for dashboard
router.get('/count', verifyAdmin, async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user count' });
    }
});

// Get deleted users archive
router.get('/deleted', verifyAdmin, async (req, res) => {
    try {
        const deletedUsers = await DeletedUser.find().sort({ deletedAt: -1 });
        res.json(deletedUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch deleted users' });
    }
});

// Update user (admin only)
router.patch('/:id', verifyAdmin, async (req, res) => {
    try {
        const { username, email, role, status } = req.body;
        const updateData = {};

        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (role && ['user', 'admin'].includes(role)) updateData.role = role;
        if (status && ['active', 'suspended', 'banned', 'pending'].includes(status)) updateData.status = status;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message || 'Failed to update user' });
    }
});

// Update user role (admin only)
router.patch('/:id/role', verifyAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Update user status (admin only)
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'suspended', 'banned', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Soft delete user - archive to DeletedUser collection (admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Archive to DeletedUser collection
        await DeletedUser.create({
            originalId: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            originalCreatedAt: user.createdAt,
            deletedBy: req.user._id,
            reason: req.body?.reason || 'Deleted by admin'
        });

        // Delete from User collection
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'User archived and deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Restore deleted user (admin only)
router.post('/restore/:id', verifyAdmin, async (req, res) => {
    try {
        const deletedUser = await DeletedUser.findById(req.params.id);

        if (!deletedUser) {
            return res.status(404).json({ error: 'Deleted user not found' });
        }

        // Check if email or username already exists
        const existing = await User.findOne({
            $or: [
                { email: deletedUser.email },
                { username: deletedUser.username }
            ]
        });

        if (existing) {
            return res.status(400).json({ error: 'Username or email already in use' });
        }

        // Restore user (without password - they'll need to reset)
        const restoredUser = await User.create({
            username: deletedUser.username,
            email: deletedUser.email,
            password: 'TempPassword123!', // They'll need to reset
            role: deletedUser.role,
            status: 'active'
        });

        // Remove from deleted collection
        await DeletedUser.findByIdAndDelete(req.params.id);

        res.json({ message: 'User restored successfully', user: restoredUser });
    } catch (error) {
        console.error('Error restoring user:', error);
        res.status(500).json({ error: 'Failed to restore user' });
    }
});

module.exports = router;
