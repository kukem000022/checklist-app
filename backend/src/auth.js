import { admin, userClient } from "./supabase.js";

export async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing access token" });
    }

    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid access token" });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, status")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: "Profile is not available" });
    }

    if (profile.status !== "active") {
      return res.status(403).json({ error: "Account is not active" });
    }

    req.profile = profile;
    req.accessToken = token;
    req.user = data.user;
    req.db = userClient(token);
    next();
  } catch (error) {
    next(error);
  }
}
