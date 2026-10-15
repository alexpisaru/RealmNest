//! Process-tree ownership. On Windows every child goes into its own Job Object
//! with KILL_ON_JOB_CLOSE: terminating the job ends the child and everything it
//! started, and if RealmNest itself dies the OS closes the handle and kills them too.

use std::process::Child;

#[cfg(windows)]
mod imp {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub struct Tree {
        job: HANDLE,
    }

    // the handle is only used through thread-safe Win32 calls
    unsafe impl Send for Tree {}
    unsafe impl Sync for Tree {}

    impl Tree {
        /// Puts `child` in a new kill-on-close job. None if the OS refuses
        /// (the caller then falls back to killing the child alone).
        pub fn adopt(child: &Child) -> Option<Tree> {
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if job.is_null() {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let ok = SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const core::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                ) != 0
                    && AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE) != 0;
                if !ok {
                    CloseHandle(job);
                    return None;
                }
                Some(Tree { job })
            }
        }

        pub fn kill(&self) {
            unsafe {
                TerminateJobObject(self.job, 1);
            }
        }
    }

    impl Drop for Tree {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.job);
            }
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use std::process::Child;

    /// Other platforms: the child alone for now (process groups to come with macOS/Linux support).
    pub struct Tree {
        pid: u32,
    }

    impl Tree {
        pub fn adopt(child: &Child) -> Option<Tree> {
            Some(Tree { pid: child.id() })
        }
        pub fn kill(&self) {
            let _ = std::process::Command::new("kill")
                .arg("-9")
                .arg(self.pid.to_string())
                .status();
        }
    }
}

pub use imp::Tree;

/// Kill the whole tree when we own it, otherwise at least the child.
pub fn kill(tree: Option<&Tree>, child: &mut Child) {
    if let Some(t) = tree {
        t.kill();
    }
    let _ = child.kill();
}
