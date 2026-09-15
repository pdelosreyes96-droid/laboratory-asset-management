-- ============================================================
-- LABORATORY ASSET AND SERVICE MANAGEMENT SYSTEM
-- LAB 4-A: Role-Based Access Control, Workflow & Audit Trail Schema
-- Platform: Supabase (PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- 1. PROFILES TABLE (User Roles: Administrator, Laboratory Staff, Requester / Viewer)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Requester / Viewer'
        CHECK (role IN ('Administrator', 'Laboratory Staff', 'Requester / Viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EQUIPMENT TABLE
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_tag TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Borrowed', 'Under Maintenance', 'Damaged')),
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BORROWING REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.borrowing_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id),
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Released', 'Returned', 'Overdue', 'Closed')),
    requested_date TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    released_by UUID REFERENCES public.profiles(id),
    released_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUDIT LOGS TABLE (Immutable Audit Trail — BR-A4-10)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    user_name TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Performance for Foreign Keys & Common Queries)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_requester ON public.borrowing_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_equipment ON public.borrowing_requests(equipment_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_status ON public.borrowing_requests(status);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_requested_date ON public.borrowing_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_approved_by ON public.borrowing_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_borrowing_requests_released_by ON public.borrowing_requests(released_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Helper: Check if the current user has a given role
-- (Used inside RLS policy expressions)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- PROFILES RLS POLICIES
-- ------------------------------------------------------------

-- Any authenticated user can view any profile (needed for requester name display)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admins can insert profiles (normally handled via trigger from auth.users,
-- but allowed for administrative bootstrapping)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Users can update their own profile; Admins can update any profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Only Admins can delete profiles
DROP POLICY IF EXISTS "Only Admins can delete profiles" ON public.profiles;
CREATE POLICY "Only Admins can delete profiles"
    ON public.profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- ------------------------------------------------------------
-- EQUIPMENT RLS POLICIES
-- ------------------------------------------------------------

-- All authenticated users can read equipment
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
CREATE POLICY "Authenticated users can view equipment"
    ON public.equipment FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only Admins and Staff can create equipment
DROP POLICY IF EXISTS "Admins and Staff can create equipment" ON public.equipment;
CREATE POLICY "Admins and Staff can create equipment"
    ON public.equipment FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Administrator', 'Laboratory Staff')
        )
    );

-- Only Admins and Staff can update equipment
DROP POLICY IF EXISTS "Admins and Staff can update equipment" ON public.equipment;
CREATE POLICY "Admins and Staff can update equipment"
    ON public.equipment FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Administrator', 'Laboratory Staff')
        )
    );

-- Only Admins can delete equipment
DROP POLICY IF EXISTS "Only Admins can delete equipment" ON public.equipment;
CREATE POLICY "Only Admins can delete equipment"
    ON public.equipment FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- ------------------------------------------------------------
-- BORROWING REQUESTS RLS POLICIES
-- ------------------------------------------------------------

-- Requesters can view their own requests; Staff and Admins can view all
DROP POLICY IF EXISTS "Users can view own requests; Staff/Admins see all" ON public.borrowing_requests;
CREATE POLICY "Users can view own requests; Staff/Admins see all"
    ON public.borrowing_requests FOR SELECT
    USING (
        requester_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Administrator', 'Laboratory Staff')
        )
    );

-- Any authenticated user can submit a borrow request (as the requester)
DROP POLICY IF EXISTS "Authenticated users can create borrow requests" ON public.borrowing_requests;
CREATE POLICY "Authenticated users can create borrow requests"
    ON public.borrowing_requests FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND requester_id = auth.uid()
    );

-- Requesters can cancel only their own Pending requests; Staff/Admins can update any
DROP POLICY IF EXISTS "Requesters can update own pending requests; Staff/Admins can update all" ON public.borrowing_requests;
CREATE POLICY "Requesters can update own pending requests; Staff/Admins can update all"
    ON public.borrowing_requests FOR UPDATE
    USING (
        (requester_id = auth.uid() AND status = 'Pending')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Administrator', 'Laboratory Staff')
        )
    );

-- Only Admins can delete borrowing requests
DROP POLICY IF EXISTS "Only Admins can delete borrowing requests" ON public.borrowing_requests;
CREATE POLICY "Only Admins can delete borrowing requests"
    ON public.borrowing_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- ------------------------------------------------------------
-- AUDIT LOGS RLS POLICIES (Read-only by Admins; Insert only via Trigger)
-- ------------------------------------------------------------

-- Only Admins can read audit logs
DROP POLICY IF EXISTS "Only Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- No direct INSERT policy for regular users — inserts happen only
-- through the SECURITY DEFINER trigger function.
-- (RLS is bypassed by SECURITY DEFINER functions.)

-- No UPDATE policy — audit logs are immutable

-- No DELETE policy — audit logs are immutable

-- ============================================================
-- UTILITY TRIGGERS
-- ============================================================

-- Auto-update `updated_at` column on row modification (generic)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at_profiles ON public.profiles;
CREATE TRIGGER trigger_set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_equipment ON public.equipment;
CREATE TRIGGER trigger_set_updated_at_equipment
    BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_borrowing_requests ON public.borrowing_requests;
CREATE TRIGGER trigger_set_updated_at_borrowing_requests
    BEFORE UPDATE ON public.borrowing_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- AUTOMATIC AUDIT LOGGING TRIGGER
-- Logs every INSERT and every status change on borrowing_requests
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_borrowing_request_change()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    current_user_name TEXT;
BEGIN
    -- Look up the full name of the acting user
    SELECT full_name INTO current_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    -- INSERT: A new borrowing request was submitted
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, description)
        VALUES (
            auth.uid(),
            COALESCE(current_user_name, 'System User'),
            'SUBMITTED',
            'Borrowing',
            NEW.id::text,
            'New borrowing request submitted for equipment ID ' || NEW.equipment_id::text
        );
        RETURN NEW;
    END IF;

    -- UPDATE: Check if the status field changed
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.status IS DISTINCT FROM OLD.status) THEN
            INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, description)
            VALUES (
                auth.uid(),
                COALESCE(current_user_name, 'System User'),
                UPPER(NEW.status),
                'Borrowing',
                NEW.id::text,
                'Status changed from ' || COALESCE(OLD.status, 'NULL') || ' to ' || COALESCE(NEW.status, 'NULL')
            );
        END IF;

        -- Track who approved the request
        IF (NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL) THEN
            INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, description)
            VALUES (
                NEW.approved_by,
                COALESCE((SELECT full_name FROM public.profiles WHERE id = NEW.approved_by), 'Unknown'),
                'ACTION',
                'Borrowing',
                NEW.id::text,
                'Request approved by staff ID ' || NEW.approved_by::text
            );
        END IF;

        -- Track who released the equipment
        IF (NEW.released_by IS DISTINCT FROM OLD.released_by AND NEW.released_by IS NOT NULL) THEN
            INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, description)
            VALUES (
                NEW.released_by,
                COALESCE((SELECT full_name FROM public.profiles WHERE id = NEW.released_by), 'Unknown'),
                'ACTION',
                'Borrowing',
                NEW.id::text,
                'Equipment released by staff ID ' || NEW.released_by::text
            );
        END IF;

        -- Track return event
        IF (NEW.returned_at IS DISTINCT FROM OLD.returned_at AND NEW.returned_at IS NOT NULL) THEN
            INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, description)
            VALUES (
                auth.uid(),
                COALESCE(current_user_name, 'System User'),
                'RETURNED',
                'Borrowing',
                NEW.id::text,
                'Equipment return recorded on ' || NEW.returned_at::text
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_borrowing_audit ON public.borrowing_requests;
CREATE TRIGGER trigger_borrowing_audit
    AFTER INSERT OR UPDATE ON public.borrowing_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_borrowing_request_change();

-- ============================================================
-- EQUIPMENT STATUS SYNC TRIGGER
-- Automatically sets equipment.status based on borrowing request state:
--   - Released  → equipment becomes 'Borrowed'
--   - Returned  → equipment becomes 'Available'
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_equipment_status()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When a request is Released, mark the equipment as Borrowed
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.status = 'Released' AND OLD.status <> 'Released') THEN
            UPDATE public.equipment
            SET status = 'Borrowed', updated_at = NOW()
            WHERE id = NEW.equipment_id;
        END IF;

        -- When a request transitions to Returned or Closed, mark equipment Available again
        IF (NEW.status IN ('Returned', 'Closed') AND OLD.status NOT IN ('Returned', 'Closed')) THEN
            UPDATE public.equipment
            SET status = 'Available', updated_at = NOW()
            WHERE id = NEW.equipment_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_equipment_status ON public.borrowing_requests;
CREATE TRIGGER trigger_sync_equipment_status
    AFTER UPDATE ON public.borrowing_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_equipment_status();

-- ============================================================
-- SAMPLE / SEED DATA
-- ============================================================

INSERT INTO public.equipment (asset_tag, name, category, status, location) VALUES
    ('LAP-001', 'Dell Latitude 5420 Laptop', 'Electronics', 'Available', 'Lab Room 301'),
    ('MIC-002', 'Digital Compound Microscope', 'Scientific', 'Available', 'Lab Room 302'),
    ('OSC-003', 'Tektronix Digital Oscilloscope', 'Electronics', 'Under Maintenance', 'Lab Storage B'),
    ('PROJ-004', 'Epson LCD Projector', 'AV Equipment', 'Borrowed', 'Lab Room 301')
ON CONFLICT (asset_tag) DO NOTHING;
