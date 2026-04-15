import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

app.use(cors());
app.use(express.json());

const normalizePhone = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  return hasPlus ? `+${digits}` : digits;
};

const getSupportContact = () => {
  const email = String(process.env.SUPPORT_EMAIL || '').trim();
  const phone = String(process.env.SUPPORT_PHONE || '').trim();
  const whatsapp = String(process.env.SUPPORT_WHATSAPP || '').trim();
  return {
    email: email || undefined,
    phone: phone || undefined,
    whatsapp: whatsapp || undefined,
  };
};

// MongoDB Connection (serverless-safe)
const getMongoUriFromEnv = () => {
  const envUri = (process.env.MONGO_URI || '').trim().replace(/^["']|["']$/g, '');

  if (!envUri) {
    throw new Error('Missing MONGO_URI. Set it in your environment variables.');
  }

  if (envUri.startsWith('mongodb://') || envUri.startsWith('mongodb+srv://')) {
    return envUri;
  }

  throw new Error('Invalid MONGO_URI. It must start with mongodb:// or mongodb+srv://');
};

let mongoConnectPromise: Promise<typeof mongoose> | null = null;
const connectMongo = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoConnectPromise) {
    const uri = getMongoUriFromEnv();
    mongoConnectPromise = mongoose.connect(uri).catch((err) => {
      mongoConnectPromise = null;
      throw err;
    });
  }
  await mongoConnectPromise;
};

app.use('/api', async (_req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    res.status(500).json({ message: 'Database connection error' });
  }
});

// --- Schemas ---

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'admin', 'manager', 'user', 'terminal'], default: 'user' },
  outletId: { type: String },
  displayName: { type: String },
  createdBy: { type: String },
  isApproved: { type: Boolean, default: true }
});

const outletSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  managerId: { type: String },
  createdBy: { type: String },
  licenseNumber: { type: String },
  licenseValidUntil: { type: Date }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true },
  unitPrice: { type: Number, required: true },
  description: { type: String }
});

const inventorySchema = new mongoose.Schema({
  productId: { type: String, required: true },
  outletId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const inventoryAdditionSchema = new mongoose.Schema({
  outletId: { type: String, required: true },
  productId: { type: String, required: true },
  quantityAdded: { type: Number, required: true },
  previousQuantity: { type: Number, required: true, default: 0 },
  newQuantity: { type: Number, required: true },
  addedByUserId: { type: String, required: true },
  source: { type: String, enum: ['manual', 'transfer_in'], required: true },
  transferId: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const saleSchema = new mongoose.Schema({
  outletId: { type: String, required: true },
  userId: { type: String, required: true },
  items: [{
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  subtotal: { type: Number },
  discountType: { type: String, enum: ['amount', 'percent'] },
  discountValue: { type: Number },
  discountAmount: { type: Number },
  totalAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const transferEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['created', 'status_changed', 'note'], required: true },
    statusFrom: { type: String, enum: ['pending', 'completed', 'cancelled'] },
    statusTo: { type: String, enum: ['pending', 'completed', 'cancelled'] },
    note: { type: String },
    userId: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema({
  fromOutletId: { type: String, required: true },
  toOutletId: { type: String, required: true },
  productId: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdByUserId: { type: String },
  lastUpdatedByUserId: { type: String },
  events: { type: [transferEventSchema], default: [] },
  timestamp: { type: Date, default: Date.now }
});

const accessRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  country: { type: String, required: true },
  businessName: { type: String, required: true },
  message: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
  rejectionReason: { type: String },
  createdUserId: { type: String }
});

const User = mongoose.model('User', userSchema);
const Outlet = mongoose.model('Outlet', outletSchema);
const Product = mongoose.model('Product', productSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const InventoryAddition = mongoose.model('InventoryAddition', inventoryAdditionSchema);
const Sale = mongoose.model('Sale', saleSchema);
const Transfer = mongoose.model('Transfer', transferSchema);
const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

const generateSku = () => `SKU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveManagerOutletId = async (userId: string) => {
  const actingUser = await User.findById(userId).select('outletId');
  const directOutletId = String((actingUser as any)?.outletId || '');
  if (directOutletId) return directOutletId;

  const managedOutlet = await Outlet.findOne({ managerId: userId }).select('_id');
  const managedOutletId = String((managedOutlet as any)?._id || '');
  return managedOutletId;
};

// --- Middleware ---

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdminEmail = email === "chungledurgeshchungle@gmail.com";
    
    const user = new User({
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      role: isSuperAdminEmail ? 'super_admin' : 'user',
      isApproved: isSuperAdminEmail ? true : false
    });

    await user.save();
    res.status(201).json({ message: isSuperAdminEmail ? 'User registered successfully' : 'Registration submitted for admin approval' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    if (user.isApproved === false) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId } });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// --- API Routes ---

// Public: request access (new customers)
app.post('/api/access-requests', async (req, res) => {
  try {
    const { fullName, email, phone, country, businessName, message } = req.body || {};

    const missing: string[] = [];
    if (!fullName) missing.push('fullName');
    if (!email) missing.push('email');
    if (!phone) missing.push('phone');
    if (!country) missing.push('country');
    if (!businessName) missing.push('businessName');
    if (missing.length) return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });

    const normalizedEmail = String(email).trim().toLowerCase();
    const alreadyUser = await User.findOne({ email: normalizedEmail });
    if (alreadyUser) return res.status(409).json({ message: 'An account with this email already exists. Please try logging in.' });

    const existingPending = await AccessRequest.findOne({ email: normalizedEmail, status: 'pending' });
    if (existingPending) return res.status(409).json({ message: 'A request for this email is already pending approval.' });

    const doc = new AccessRequest({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      country: String(country).trim(),
      businessName: String(businessName).trim(),
      message: message ? String(message).trim() : undefined,
      status: 'pending',
    });

    await doc.save();
    res.status(201).json({ message: 'Request submitted successfully. Admin approval is required.' });
  } catch (err) {
    console.error('Access request error:', err);
    res.status(500).json({ message: 'Error submitting access request' });
  }
});

// Public: check access request status (email + phone)
app.get('/api/access-requests/status', async (req, res) => {
  try {
    const email = String(req.query?.email || '').trim().toLowerCase();
    const phone = String(req.query?.phone || '').trim();
    if (!email || !phone) {
      return res.status(400).json({
        message: 'email and phone are required',
        supportContact: getSupportContact(),
      });
    }

    const request = await AccessRequest.findOne({ email }).sort({ createdAt: -1 });
    if (!request) {
      return res.status(404).json({
        message: 'No access request found for this email.',
        supportContact: getSupportContact(),
      });
    }

    const samePhone = normalizePhone(request.phone) === normalizePhone(phone);
    if (!samePhone) {
      return res.status(403).json({
        message: 'Phone number does not match this access request.',
        supportContact: getSupportContact(),
      });
    }

    return res.json({
      status: request.status,
      createdAt: request.createdAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      supportContact: getSupportContact(),
    });
  } catch (err) {
    console.error('Access status error:', err);
    res.status(500).json({ message: 'Error checking access request status' });
  }
});

// Admin: list access requests
app.get('/api/access-requests', authenticateToken, async (req: any, res) => {
  const role = req.user?.role;
  if (role !== 'super_admin') {
    return res.status(403).json({ message: 'Unauthorized to view access requests' });
  }

  const status = String(req.query?.status || '').trim();
  const filter: any = {};
  if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;

  const list = await AccessRequest.find(filter).sort({ createdAt: -1 });
  res.json(list);
});

// Admin: approve (creates user)
app.post('/api/access-requests/:id/approve', authenticateToken, async (req: any, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'super_admin') {
      return res.status(403).json({ message: 'Unauthorized to approve access requests' });
    }

    const request = await AccessRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Access request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: `Request already ${request.status}` });

    const { password, userRole, outletId, displayName } = req.body || {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password is required (min 6 chars)' });
    }

    const normalizedEmail = String(request.email).trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(String(password), 10);

    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.password = hashedPassword;
      if (userRole) user.role = userRole;
      if (typeof outletId === 'string') user.outletId = outletId || undefined;
      if (typeof displayName === 'string' && displayName.trim()) user.displayName = displayName.trim();
      user.isApproved = true;
      await user.save();
    } else {
      user = new User({
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole || 'user',
        outletId: outletId || undefined,
        displayName: (displayName && String(displayName).trim()) || request.fullName,
        createdBy: String(req.user.id),
        isApproved: true,
      });
      await user.save();
    }

    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = String(req.user.id);
    request.createdUserId = String(user._id);
    await request.save();

    res.json({ message: 'Approved and user created', userId: user._id });
  } catch (err) {
    console.error('Approve request error:', err);
    res.status(500).json({ message: 'Error approving access request' });
  }
});

// Admin: reject
app.post('/api/access-requests/:id/reject', authenticateToken, async (req: any, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'super_admin') {
      return res.status(403).json({ message: 'Unauthorized to reject access requests' });
    }

    const request = await AccessRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Access request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: `Request already ${request.status}` });

    const { reason } = req.body || {};
    request.status = 'rejected';
    request.rejectedAt = new Date();
    request.rejectedBy = String(req.user.id);
    request.rejectionReason = reason ? String(reason).trim() : undefined;
    await request.save();

    res.json({ message: 'Rejected access request' });
  } catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ message: 'Error rejecting access request' });
  }
});

// Users
app.get('/api/users', authenticateToken, async (req: any, res: any) => {
  const role = req.user?.role;
  const userId = String(req.user?.id || '');
  if (!['super_admin', 'admin', 'manager'].includes(role)) {
    return res.status(403).json({ message: 'Unauthorized to view users' });
  }

  const filter: any = {};
  // Admins can only see the managers/users they created
  if (role === 'admin') {
    filter.createdBy = String(req.user.id);
    filter.role = { $in: ['manager', 'user'] };
  }

  // Managers can only see users assigned to their outlet
  if (role === 'manager') {
    const outletId = await resolveManagerOutletId(userId);
    if (!outletId) {
      return res.status(400).json({ message: 'Manager has no outlet assignment' });
    }
    filter.outletId = outletId;
    filter.role = 'user';
  }

  const users = await User.find(filter, '-password');
  res.json(users.map(u => ({ uid: u._id, email: u.email, role: u.role, displayName: u.displayName, outletId: u.outletId })));
});

app.post('/api/users', authenticateToken, async (req: any, res) => {
  try {
    const { email, password, role, displayName, outletId } = req.body || {};
    const creatorRole = String(req.user?.role || '');
    const creatorId = String(req.user?.id || '');

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ message: 'Email is required' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password is required (min 6 chars)' });
    }

    let targetRole = String(role || 'user');
    let targetOutletId = typeof outletId === 'string' ? outletId : '';

    if (creatorRole === 'manager') {
      // Managers can only create outlet users (role = user) for their own outlet
      targetRole = 'user';
      targetOutletId = await resolveManagerOutletId(creatorId);
      if (!targetOutletId) {
        return res.status(400).json({ message: 'Manager has no outlet assignment' });
      }
    }

    // Hierarchical validation
    if (creatorRole === 'super_admin') {
      // Super admin can create any role
    } else if (creatorRole === 'admin') {
      // Admin can only create manager, user, terminal
      if (['super_admin', 'admin'].includes(targetRole)) {
        return res.status(403).json({ message: 'Admins cannot create super admins or other admins' });
      }
    } else if (creatorRole === 'manager') {
      // Managers can only create users
      if (targetRole !== 'user') {
        return res.status(403).json({ message: 'Managers can only create users with role user' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to create users' });
    }

    // Only super_admin can create an admin user
    if (targetRole === 'admin' && creatorRole !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can create admins' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role: targetRole,
      displayName: (displayName && String(displayName).trim()) || normalizedEmail.split('@')[0],
      outletId: targetOutletId || undefined,
      createdBy: creatorId
    });

    await user.save();
    res.status(201).json({ uid: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.patch('/api/users/:id', authenticateToken, async (req: any, res) => {
  try {
    const creatorRole = req.user.role;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const newRole = req.body.role;
    if (newRole === 'admin' && creatorRole !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can promote users to admin' });
    }

    // Hierarchical validation for updates
    if (creatorRole === 'super_admin') {
      // Super admin can update anyone
    } else if (creatorRole === 'admin') {
      // Admin can only update users they created
      if (String((targetUser as any).createdBy || '') !== String(req.user.id)) {
        return res.status(403).json({ message: 'Admins can only modify users they created' });
      }
      // Admin cannot update super admins or other admins
      if (['super_admin', 'admin'].includes(targetUser.role)) {
        return res.status(403).json({ message: 'Admins cannot modify super admins or other admins' });
      }
      // Admin cannot promote someone to super_admin or admin
      if (newRole && ['super_admin', 'admin'].includes(newRole)) {
        return res.status(403).json({ message: 'Admins cannot promote users to admin or super admin' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to update users' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ uid: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Outlets
app.get('/api/outlets', authenticateToken, async (req, res) => {
  try {
    const role = (req as any).user?.role;
    const userId = String((req as any).user?.id || '');

    const filter: any = {};
    if (role === 'super_admin') {
      // super admin sees everything
    } else if (role === 'admin') {
      // admins only see outlets they created
      filter.createdBy = userId;
    } else {
      // managers/users/terminal only see their assigned outlet (or the outlet they manage)
      const actingUser = await User.findById(userId).select('outletId');
      const outletId = String((actingUser as any)?.outletId || '');

      if (!outletId) {
        // Allow manager visibility via managerId even without outletId set
        filter.managerId = userId;
      } else {
        filter.$or = [{ _id: outletId }, { managerId: userId }];
      }
    }

    const outlets = await Outlet.find(filter);
    res.json(outlets.map(o => ({
      id: o._id,
      name: o.name,
      location: o.location,
      managerId: o.managerId,
      licenseNumber: (o as any).licenseNumber,
      licenseValidUntil: (o as any).licenseValidUntil
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/outlets', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to create outlets' });
    }

    (req as any).body.createdBy = String((req as any).user?.id || '');

    const managerId = typeof req.body?.managerId === 'string' ? req.body.managerId.trim() : '';
    if (managerId) {
      const alreadyAssigned = await Outlet.findOne({ managerId });
      if (alreadyAssigned) {
        return res.status(409).json({ message: 'This manager is already assigned to another outlet' });
      }
      req.body.managerId = managerId;
    } else {
      req.body.managerId = null;
    }

    const outlet = new Outlet(req.body);
    await outlet.save();

    if (managerId) {
      await User.findByIdAndUpdate(managerId, { outletId: String(outlet._id) });
    }

    res.status(201).json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to update outlets' });
    }

    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });

    if ((req as any).user?.role === 'admin' && String((outlet as any).createdBy || '') !== String((req as any).user?.id || '')) {
      return res.status(403).json({ message: 'Admins can only modify outlets they created' });
    }

    const oldManagerId = (outlet as any).managerId as string | undefined;
    const nextManagerIdRaw = req.body?.managerId;
    const nextManagerId = typeof nextManagerIdRaw === 'string' ? nextManagerIdRaw.trim() : '';
    const managerIdToSet = nextManagerId || null;

    if (managerIdToSet && managerIdToSet !== oldManagerId) {
      const alreadyAssigned = await Outlet.findOne({ managerId: managerIdToSet, _id: { $ne: outlet._id } });
      if (alreadyAssigned) {
        return res.status(409).json({ message: 'This manager is already assigned to another outlet' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) (outlet as any).name = req.body.name;
    if (Object.prototype.hasOwnProperty.call(req.body, 'location')) (outlet as any).location = req.body.location;
    if (Object.prototype.hasOwnProperty.call(req.body, 'managerId')) (outlet as any).managerId = managerIdToSet;
    if (Object.prototype.hasOwnProperty.call(req.body, 'licenseNumber')) (outlet as any).licenseNumber = req.body.licenseNumber || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'licenseValidUntil')) (outlet as any).licenseValidUntil = req.body.licenseValidUntil || null;

    await outlet.save();

    if (Object.prototype.hasOwnProperty.call(req.body, 'managerId')) {
      const outletIdString = String(outlet._id);
      if (oldManagerId && oldManagerId !== managerIdToSet) {
        await User.updateOne({ _id: oldManagerId, outletId: outletIdString }, { $unset: { outletId: '' } });
      }
      if (managerIdToSet) {
        await User.findByIdAndUpdate(managerIdToSet, { outletId: outletIdString });
      }
    }

    res.json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes((req as any).user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to delete outlets' });
    }

    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });

    if ((req as any).user?.role === 'admin' && String((outlet as any).createdBy || '') !== String((req as any).user?.id || '')) {
      return res.status(403).json({ message: 'Admins can only delete outlets they created' });
    }

    await Outlet.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Products
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(p => ({ id: p._id, name: p.name, category: p.category, sku: p.sku, unitPrice: p.unitPrice, description: p.description })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (typeof (req as any).body?.sku === 'string' && (req as any).body.sku.trim() === '') {
      delete (req as any).body.sku;
    }
    const skuWasProvided = Object.prototype.hasOwnProperty.call((req as any).body || {}, 'sku');

    const product = new Product(req.body);
    try {
      await product.save();
    } catch (err: any) {
      const isDupSku = err?.code === 11000 && (err?.keyPattern?.sku || err?.keyValue?.sku);
      if (!skuWasProvided && isDupSku) {
        (product as any).sku = generateSku();
        await product.save();
      } else {
        throw err;
      }
    }

    res.status(201).json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (typeof (req as any).body?.sku === 'string' && (req as any).body.sku.trim() === '') {
      delete (req as any).body.sku;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Inventory
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const inventory = await Inventory.find(filter);
    res.json(inventory.map(i => ({ id: i._id, productId: i.productId, outletId: i.outletId, quantity: i.quantity, lastUpdated: i.lastUpdated })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { productId, outletId, quantity } = req.body;
    const nextQuantity = Number(quantity ?? 0);
    let item = await Inventory.findOne({ productId, outletId });
    const previousQuantity = item ? Number((item as any).quantity ?? 0) : 0;
    if (item) {
      item.quantity = nextQuantity;
      item.lastUpdated = new Date();
    } else {
      item = new Inventory({ ...req.body, quantity: nextQuantity, lastUpdated: new Date() });
    }
    await item.save();

    const quantityAdded = nextQuantity - previousQuantity;
    if (quantityAdded > 0) {
      await new InventoryAddition({
        outletId: String(outletId),
        productId: String(productId),
        quantityAdded,
        previousQuantity,
        newQuantity: nextQuantity,
        addedByUserId: String((req as any).user?.id || ''),
        source: 'manual',
      }).save();
    }

    res.status(201).json({ id: item._id, productId: item.productId, outletId: item.outletId, quantity: item.quantity, lastUpdated: item.lastUpdated });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Outlet Inventory Additions History (admin + manager view only)
app.get('/api/outlets/:id/inventory-additions', authenticateToken, async (req: any, res: any) => {
  try {
    const role = String(req.user?.role || '');
    const userId = String(req.user?.id || '');
    const outletId = String(req.params.id || '').trim();
    const limitRaw = Number(req.query?.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;

    if (!['super_admin', 'admin', 'manager'].includes(role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const outlet = await Outlet.findById(outletId).select('_id createdBy managerId');
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });

    if (role === 'admin') {
      if (String((outlet as any).createdBy || '') !== userId) {
        return res.status(403).json({ message: 'Admins can only view outlets they created' });
      }
    } else if (role === 'manager') {
      const actingUser = await User.findById(userId).select('outletId');
      const assignedOutletId = String((actingUser as any)?.outletId || '');
      const isOutletMatch = assignedOutletId ? assignedOutletId === outletId : false;
      const isManagerMatch = String((outlet as any).managerId || '') === userId;
      if (!isOutletMatch && !isManagerMatch) {
        return res.status(403).json({ message: 'Unauthorized outlet' });
      }
    }

    const logs = await InventoryAddition.find({ outletId }).sort({ timestamp: -1 }).limit(limit);

    const productIds = new Set<string>();
    const userIds = new Set<string>();
    for (const l of logs) {
      if ((l as any).productId) productIds.add(String((l as any).productId));
      if ((l as any).addedByUserId) userIds.add(String((l as any).addedByUserId));
    }

    const [productDocs, userDocs] = await Promise.all([
      Product.find(productIds.size ? { _id: { $in: Array.from(productIds) } } : {}).select('_id name sku category'),
      User.find(userIds.size ? { _id: { $in: Array.from(userIds) } } : {}).select('_id email displayName role'),
    ]);

    const productById = new Map<string, any>();
    for (const p of productDocs) productById.set(String((p as any)._id), p);
    const userById = new Map<string, any>();
    for (const u of userDocs) userById.set(String((u as any)._id), u);

    return res.json(logs.map((l: any) => {
      const p = productById.get(String(l.productId));
      const u = userById.get(String(l.addedByUserId));
      return {
        id: l._id,
        outletId: l.outletId,
        productId: l.productId,
        product: p ? { id: p._id, name: p.name, sku: p.sku, category: p.category } : null,
        quantityAdded: l.quantityAdded,
        previousQuantity: l.previousQuantity,
        newQuantity: l.newQuantity,
        addedBy: u ? { id: u._id, email: u.email, displayName: u.displayName, role: u.role } : null,
        source: l.source,
        transferId: l.transferId,
        timestamp: l.timestamp,
      };
    }));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Sales
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const sales = await Sale.find(filter).sort({ timestamp: -1 });
    res.json(sales.map(s => ({
      id: s._id,
      outletId: s.outletId,
      userId: s.userId,
      items: s.items,
      subtotal: (s as any).subtotal,
      discountType: (s as any).discountType,
      discountValue: (s as any).discountValue,
      discountAmount: (s as any).discountAmount,
      totalAmount: s.totalAmount,
      timestamp: s.timestamp
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Reports (admin only)
app.get(['/api/reports/sales', '/api/reports/sales.csv'], authenticateToken, async (req: any, res: any) => {
  try {
    if (!['super_admin', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const outletIdRaw = (req.query?.outletId || '').toString().trim();
    const fromRaw = (req.query?.from || '').toString().trim();
    const toRaw = (req.query?.to || '').toString().trim();

    const timestampFilter: any = {};
    if (fromRaw) {
      const d = new Date(fromRaw);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid from date' });
      timestampFilter.$gte = d;
    }
    if (toRaw) {
      const d = new Date(toRaw);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid to date' });
      timestampFilter.$lte = d;
    }

    const filter: any = {};
    if (outletIdRaw) filter.outletId = outletIdRaw;
    if (Object.keys(timestampFilter).length) filter.timestamp = timestampFilter;

    const sales = await Sale.find(filter).sort({ timestamp: -1 });

    const outletIds = new Set<string>();
    const productIds = new Set<string>();
    for (const s of sales) {
      if ((s as any).outletId) outletIds.add(String((s as any).outletId));
      for (const it of (s as any).items || []) {
        if (it?.productId) productIds.add(String(it.productId));
      }
    }

    const [outletDocs, productDocs] = await Promise.all([
      Outlet.find(outletIds.size ? { _id: { $in: Array.from(outletIds) } } : {}).select('_id name'),
      Product.find(productIds.size ? { _id: { $in: Array.from(productIds) } } : {}).select('_id name sku category'),
    ]);

    const outletNameById = new Map<string, string>();
    for (const o of outletDocs) outletNameById.set(String(o._id), String((o as any).name || ''));

    const productNameById = new Map<string, string>();
    for (const p of productDocs) productNameById.set(String(p._id), String((p as any).name || ''));

    const csvEscape = (value: any) => {
      const s = value === null || value === undefined ? '' : String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'saleId',
      'timestamp',
      'outletId',
      'outletName',
      'userId',
      'itemsCount',
      'itemsSummary',
      'subtotal',
      'discountType',
      'discountValue',
      'discountAmount',
      'totalAmount',
    ];

    const rows = sales.map((s: any) => {
      const outletName = outletNameById.get(String(s.outletId)) || '';
      const items = Array.isArray(s.items) ? s.items : [];
      const itemsCount = items.reduce((sum: number, it: any) => sum + Number(it?.quantity || 0), 0);
      const itemsSummary = items
        .slice(0, 50)
        .map((it: any) => {
          const name = productNameById.get(String(it.productId)) || String(it.productId || '');
          const qty = Number(it.quantity || 0);
          const price = Number(it.price || 0);
          return `${name} x${qty} @${price}`;
        })
        .join('; ');

      return [
        s._id,
        s.timestamp ? new Date(s.timestamp).toISOString() : '',
        s.outletId,
        outletName,
        s.userId,
        itemsCount,
        itemsSummary,
        (s as any).subtotal ?? '',
        (s as any).discountType ?? '',
        (s as any).discountValue ?? '',
        (s as any).discountAmount ?? '',
        s.totalAmount ?? '',
      ].map(csvEscape).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');
    const fileName = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csv);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Failed to generate report' });
  }
});

app.post('/api/sales', authenticateToken, async (req: any, res: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const saleOutletId = req.body?.outletId;
    if (!saleOutletId) {
      throw new Error('outletId is required');
    }

    // Enforce outlet assignment for non-admin users
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      const actingUser = await User.findById(req.user.id).select('outletId').session(session);
      if (!actingUser?.outletId) {
        return res.status(403).json({ message: 'User is not assigned to an outlet' });
      }
      if (actingUser.outletId !== saleOutletId) {
        return res.status(403).json({ message: 'Unauthorized outlet for this sale' });
      }
    }

    // Block sales for expired licenses (user/manager/terminal)
    const outlet = await Outlet.findById(saleOutletId).select('licenseValidUntil').session(session);
    const licenseValidUntil = (outlet as any)?.licenseValidUntil as Date | undefined;
    if (
      licenseValidUntil &&
      licenseValidUntil.getTime() < Date.now() &&
      ['manager', 'user', 'terminal'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Outlet license expired. Sales are disabled for this outlet.' });
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ message: 'Sale items are required' });
    }

    const items = rawItems.map((it: any) => ({
      productId: String(it.productId || ''),
      quantity: Number(it.quantity),
      price: Number(it.price),
    }));

    for (const it of items) {
      if (!it.productId) return res.status(400).json({ message: 'Invalid productId in items' });
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) return res.status(400).json({ message: 'Invalid quantity in items' });
      if (!Number.isFinite(it.price) || it.price < 0) return res.status(400).json({ message: 'Invalid price in items' });
    }

    const subtotal = items.reduce((sum: number, it: any) => sum + it.quantity * it.price, 0);

    const discountTypeRaw = String(req.body?.discountType || '').trim();
    const discountType = discountTypeRaw === 'percent' ? 'percent' : discountTypeRaw === 'amount' ? 'amount' : null;
    const discountValue = Number(req.body?.discountValue || 0);

    if (discountType && (!Number.isFinite(discountValue) || discountValue < 0)) {
      return res.status(400).json({ message: 'Invalid discount value' });
    }

    let discountAmount = 0;
    if (discountType === 'percent') {
      if (discountValue > 100) return res.status(400).json({ message: 'Discount percent cannot exceed 100' });
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === 'amount') {
      discountAmount = discountValue;
    }

    if (discountAmount > subtotal) {
      return res.status(400).json({ message: 'Discount cannot exceed subtotal' });
    }

    const totalAmount = subtotal - discountAmount;

    const sale = new Sale({
      outletId: saleOutletId,
      userId: String(req.body?.userId || req.user.id),
      items,
      subtotal,
      discountType: discountType || undefined,
      discountValue: discountType ? discountValue : undefined,
      discountAmount: discountType ? discountAmount : undefined,
      totalAmount,
    });
    await sale.save({ session });

    // Update inventory
    for (const item of sale.items) {
      const inv = await Inventory.findOne({ productId: item.productId, outletId: sale.outletId }).session(session);
      if (!inv || inv.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      inv.quantity -= item.quantity;
      inv.lastUpdated = new Date();
      await inv.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json({
      id: sale._id,
      outletId: sale.outletId,
      userId: sale.userId,
      items: sale.items,
      subtotal: (sale as any).subtotal,
      discountType: (sale as any).discountType,
      discountValue: (sale as any).discountValue,
      discountAmount: (sale as any).discountAmount,
      totalAmount: sale.totalAmount,
      timestamp: sale.timestamp
    });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

app.post('/api/sales/:id/send-sms', authenticateToken, async (req: any, res: any) => {
  try {
    const saleId = String(req.params?.id || '').trim();
    const phoneNumber = String(req.body?.phoneNumber || '').trim().replace(/\s+/g, '');
    const customerName = String(req.body?.customerName || '').trim();

    if (!saleId) return res.status(400).json({ message: 'Sale id is required' });
    if (!/^\+\d{8,15}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid phone number. Use E.164 format, e.g. +14155552671' });
    }

    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    // Enforce outlet assignment for non-admin users
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      const actingUser = await User.findById(req.user.id).select('outletId').exec();
      if (!actingUser?.outletId) return res.status(403).json({ message: 'User is not assigned to an outlet' });
      if (String(actingUser.outletId) !== String((sale as any).outletId)) {
        return res.status(403).json({ message: 'Unauthorized outlet for this sale' });
      }
    }

    const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = String(process.env.TWILIO_FROM_NUMBER || '').trim();
    if (!sid || !token || !from) {
      return res.status(501).json({
        message: 'SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.'
      });
    }

    const ids = Array.from(new Set(((sale as any).items || []).map((it: any) => String(it.productId || '')).filter(Boolean)));
    const products = await Product.find({ _id: { $in: ids } }).select('name').exec();
    const productNameById = new Map<string, string>(products.map((p: any) => [String(p._id), String(p.name)]));

    const items = Array.isArray((sale as any).items) ? (sale as any).items : [];
    const preview = items.slice(0, 6).map((it: any) => {
      const name = productNameById.get(String(it.productId)) || 'Item';
      return `${name} x${Number(it.quantity || 0)}`;
    });
    const moreCount = Math.max(0, items.length - preview.length);

    const totalAmount = Number((sale as any).totalAmount || 0);
    const receiptId = String((sale as any)._id).slice(-6).toUpperCase();
    const dateStr = (() => {
      try {
        return new Date((sale as any).timestamp || Date.now()).toLocaleString();
      } catch {
        return '';
      }
    })();

    const bodyLines = [
      `LiquorLedger Receipt ${receiptId}`,
      dateStr ? `Date: ${dateStr}` : null,
      customerName ? `Customer: ${customerName}` : null,
      `Total: $${totalAmount.toFixed(2)}`,
      preview.length ? `Items: ${preview.join(', ')}${moreCount ? ` +${moreCount} more` : ''}` : null,
      'Thank you!',
    ].filter(Boolean);

    const messageBody = bodyLines.join('\n');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: phoneNumber, From: from, Body: messageBody });
    const twRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!twRes.ok) {
      const text = await twRes.text();
      return res.status(502).json({ message: `Failed to send SMS (${twRes.status}). ${text}` });
    }

    const data = await twRes.json();
    return res.json({ ok: true, sid: data?.sid });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Failed to send SMS' });
  }
});

// Transfers
app.get('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfers = await Transfer.find().sort({ timestamp: -1 });
    res.json(
      transfers.map(t => ({
        id: t._id,
        fromOutletId: t.fromOutletId,
        toOutletId: t.toOutletId,
        productId: t.productId,
        quantity: t.quantity,
        status: t.status,
        createdByUserId: (t as any).createdByUserId,
        lastUpdatedByUserId: (t as any).lastUpdatedByUserId,
        events: (t as any).events,
        timestamp: t.timestamp,
      }))
    );
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfer = new Transfer({
      fromOutletId: req.body?.fromOutletId,
      toOutletId: req.body?.toOutletId,
      productId: req.body?.productId,
      quantity: req.body?.quantity,
      createdByUserId: String((req as any).user?.id || ''),
      lastUpdatedByUserId: String((req as any).user?.id || ''),
      events: [
        {
          type: 'created',
          userId: String((req as any).user?.id || ''),
        },
      ],
    });
    await transfer.save();
    res.status(201).json({
      id: transfer._id,
      fromOutletId: transfer.fromOutletId,
      toOutletId: transfer.toOutletId,
      productId: transfer.productId,
      quantity: transfer.quantity,
      status: transfer.status,
      createdByUserId: (transfer as any).createdByUserId,
      lastUpdatedByUserId: (transfer as any).lastUpdatedByUserId,
      events: (transfer as any).events,
      timestamp: transfer.timestamp,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/transfers/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transfer = await Transfer.findById(req.params.id).session(session);
    if (!transfer) throw new Error('Transfer not found');

    const oldStatus = transfer.status;
    const newStatus = req.body.status;
    if (!['pending', 'completed', 'cancelled'].includes(newStatus)) {
      throw new Error('Invalid status');
    }

    if (oldStatus === 'pending' && newStatus === 'completed') {
      // Deduct from source
      const fromInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.fromOutletId }).session(session);
      if (!fromInv || fromInv.quantity < transfer.quantity) {
        throw new Error('Insufficient stock at source outlet');
      }
      fromInv.quantity -= transfer.quantity;
      await fromInv.save({ session });

      // Add to destination
      let toInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.toOutletId }).session(session);
      const previousQuantity = toInv ? Number((toInv as any).quantity ?? 0) : 0;
      if (!toInv) {
        toInv = new Inventory({ productId: transfer.productId, outletId: transfer.toOutletId, quantity: 0 });
      }
      toInv.quantity += transfer.quantity;
      await toInv.save({ session });

      await new InventoryAddition({
        outletId: String(transfer.toOutletId),
        productId: String(transfer.productId),
        quantityAdded: Number(transfer.quantity),
        previousQuantity,
        newQuantity: Number((toInv as any).quantity ?? (previousQuantity + Number(transfer.quantity))),
        addedByUserId: String((req as any).user?.id || ''),
        source: 'transfer_in',
        transferId: String(transfer._id),
      }).save({ session });
    }

    transfer.status = newStatus;
    (transfer as any).lastUpdatedByUserId = String((req as any).user?.id || '');
    if (oldStatus !== newStatus) {
      (transfer as any).events = [
        ...(((transfer as any).events || []) as any[]),
        {
          type: 'status_changed',
          statusFrom: oldStatus,
          statusTo: newStatus,
          userId: String((req as any).user?.id || ''),
        },
      ];
    }
    await transfer.save({ session });

    await session.commitTransaction();
    res.json({
      id: transfer._id,
      fromOutletId: transfer.fromOutletId,
      toOutletId: transfer.toOutletId,
      productId: transfer.productId,
      quantity: transfer.quantity,
      status: transfer.status,
      createdByUserId: (transfer as any).createdByUserId,
      lastUpdatedByUserId: (transfer as any).lastUpdatedByUserId,
      events: (transfer as any).events,
      timestamp: transfer.timestamp,
    });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

app.post('/api/transfers/:id/events', authenticateToken, async (req: any, res: any) => {
  try {
    const note = String(req.body?.note || '').trim();
    if (!note) return res.status(400).json({ message: 'Note is required' });

    const transfer = await Transfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });

    (transfer as any).lastUpdatedByUserId = String(req.user?.id || '');
    (transfer as any).events = [
      ...(((transfer as any).events || []) as any[]),
      {
        type: 'note',
        note,
        userId: String(req.user?.id || ''),
      },
    ];
    await transfer.save();

    return res.status(201).json({
      id: transfer._id,
      fromOutletId: transfer.fromOutletId,
      toOutletId: transfer.toOutletId,
      productId: transfer.productId,
      quantity: transfer.quantity,
      status: transfer.status,
      createdByUserId: (transfer as any).createdByUserId,
      lastUpdatedByUserId: (transfer as any).lastUpdatedByUserId,
      events: (transfer as any).events,
      timestamp: transfer.timestamp,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
});

app.delete('/api/transfers/:id', authenticateToken, async (req: any, res: any) => {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Unauthorized to delete transfers' });
    }

    const deleted = await Transfer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Transfer not found' });
    return res.status(204).send();
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
});

// JSON 404 for API routes (prevents frontend JSON parse failures)
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// JSON error handler for API routes
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// --- Vite Integration ---

export async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };

// In Vercel serverless, the module is imported as a handler and must not open a listener.
if (!process.env.VERCEL) {
  startServer();
}
