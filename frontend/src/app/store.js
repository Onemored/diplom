import { configureStore, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
  ApiError,
  deleteFile,
  deleteUser,
  getCurrentUser,
  getFiles,
  getPublicLink,
  getUsers,
  loginUser,
  logoutUser,
  registerUser,
  updateFile,
  updateUserRole,
  uploadFile,
} from "../api/apiClient.js";

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      return await getCurrentUser();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return rejectWithValue({ anonymous: true });
      }
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const registerAccount = createAsyncThunk(
  "auth/registerAccount",
  async (payload, { rejectWithValue }) => {
    try {
      return await registerUser(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const loginAccount = createAsyncThunk(
  "auth/loginAccount",
  async (payload, { rejectWithValue }) => {
    try {
      return await loginUser(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const logoutAccount = createAsyncThunk(
  "auth/logoutAccount",
  async (_, { rejectWithValue }) => {
    try {
      await logoutUser();
      return null;
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const fetchUsers = createAsyncThunk("users/fetchUsers", async (_, { rejectWithValue }) => {
  try {
    return await getUsers();
  } catch (error) {
    return rejectWithValue(normalizeError(error));
  }
});

export const fetchFiles = createAsyncThunk(
  "files/fetchFiles",
  async (payload = {}, { rejectWithValue }) => {
    try {
      return await getFiles(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const uploadStorageFile = createAsyncThunk(
  "files/uploadStorageFile",
  async (payload, { rejectWithValue }) => {
    try {
      return await uploadFile(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const editStorageFile = createAsyncThunk(
  "files/editStorageFile",
  async (payload, { rejectWithValue }) => {
    try {
      return await updateFile(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const removeStorageFile = createAsyncThunk(
  "files/removeStorageFile",
  async (fileId, { rejectWithValue }) => {
    try {
      await deleteFile(fileId);
      return fileId;
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const shareStorageFile = createAsyncThunk(
  "files/shareStorageFile",
  async (fileId, { rejectWithValue }) => {
    try {
      return {
        fileId,
        ...(await getPublicLink(fileId)),
      };
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const changeUserRole = createAsyncThunk(
  "users/changeUserRole",
  async (payload, { rejectWithValue }) => {
    try {
      return await updateUserRole(payload);
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

export const removeUser = createAsyncThunk(
  "users/removeUser",
  async (userId, { rejectWithValue }) => {
    try {
      await deleteUser(userId);
      return userId;
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    status: "idle",
    error: null,
  },
  reducers: {
    setAnonymous(state) {
      state.user = null;
      state.status = "anonymous";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        if (action.payload?.anonymous) {
          state.status = "anonymous";
          state.error = null;
          return;
        }
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(registerAccount.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerAccount.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
        state.error = null;
      })
      .addCase(registerAccount.rejected, (state, action) => {
        state.status = "anonymous";
        state.error = action.payload;
      })
      .addCase(loginAccount.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginAccount.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(loginAccount.rejected, (state, action) => {
        state.user = null;
        state.status = "anonymous";
        state.error = action.payload;
      })
      .addCase(logoutAccount.pending, (state) => {
        state.error = null;
      })
      .addCase(logoutAccount.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
        state.error = null;
      })
      .addCase(logoutAccount.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

const usersSlice = createSlice({
  name: "users",
  initialState: {
    items: [],
    status: "idle",
    error: null,
    roleUpdatingId: null,
    deletingId: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.items = action.payload.items ?? [];
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.items = [];
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(changeUserRole.pending, (state, action) => {
        state.roleUpdatingId = action.meta.arg.userId;
        state.error = null;
      })
      .addCase(changeUserRole.fulfilled, (state, action) => {
        state.roleUpdatingId = null;
        state.items = state.items.map((user) =>
          user.id === action.payload.id ? action.payload : user,
        );
        state.error = null;
      })
      .addCase(changeUserRole.rejected, (state, action) => {
        state.roleUpdatingId = null;
        state.error = action.payload;
      })
      .addCase(removeUser.pending, (state, action) => {
        state.deletingId = action.meta.arg;
        state.error = null;
      })
      .addCase(removeUser.fulfilled, (state, action) => {
        state.deletingId = null;
        state.items = state.items.filter((user) => user.id !== action.payload);
        state.error = null;
      })
      .addCase(removeUser.rejected, (state, action) => {
        state.deletingId = null;
        state.error = action.payload;
      });
  },
});

const filesSlice = createSlice({
  name: "files",
  initialState: {
    ownerId: null,
    owner: null,
    items: [],
    status: "idle",
    error: null,
    uploadStatus: "idle",
    updatingId: null,
    deletingId: null,
    sharingId: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.pending, (state, action) => {
        state.ownerId = action.meta.arg?.ownerId ?? null;
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.owner = action.payload.owner ?? null;
        state.items = action.payload.items ?? [];
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.owner = null;
        state.items = [];
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(uploadStorageFile.pending, (state) => {
        state.uploadStatus = "loading";
        state.error = null;
      })
      .addCase(uploadStorageFile.fulfilled, (state, action) => {
        state.items = [action.payload, ...state.items];
        state.status = "succeeded";
        state.uploadStatus = "succeeded";
        state.error = null;
      })
      .addCase(uploadStorageFile.rejected, (state, action) => {
        state.uploadStatus = "failed";
        state.error = action.payload;
      })
      .addCase(editStorageFile.pending, (state, action) => {
        state.updatingId = action.meta.arg.fileId;
        state.error = null;
      })
      .addCase(editStorageFile.fulfilled, (state, action) => {
        state.updatingId = null;
        state.items = state.items.map((file) =>
          file.id === action.payload.id ? action.payload : file,
        );
        state.error = null;
      })
      .addCase(editStorageFile.rejected, (state, action) => {
        state.updatingId = null;
        state.error = action.payload;
      })
      .addCase(removeStorageFile.pending, (state, action) => {
        state.deletingId = action.meta.arg;
        state.error = null;
      })
      .addCase(removeStorageFile.fulfilled, (state, action) => {
        state.deletingId = null;
        state.items = state.items.filter((file) => file.id !== action.payload);
        state.error = null;
      })
      .addCase(removeStorageFile.rejected, (state, action) => {
        state.deletingId = null;
        state.error = action.payload;
      })
      .addCase(shareStorageFile.pending, (state, action) => {
        state.sharingId = action.meta.arg;
        state.error = null;
      })
      .addCase(shareStorageFile.fulfilled, (state, action) => {
        state.sharingId = null;
        state.items = state.items.map((file) =>
          file.id === action.payload.fileId
            ? {
                ...file,
                publicUrl: action.payload.publicUrl,
              }
            : file,
        );
        state.error = null;
      })
      .addCase(shareStorageFile.rejected, (state, action) => {
        state.sharingId = null;
        state.error = action.payload;
      });
  },
});

export const { setAnonymous } = authSlice.actions;

const reducer = {
  auth: authSlice.reducer,
  users: usersSlice.reducer,
  files: filesSlice.reducer,
};

export function createAppStore(preloadedState) {
  return configureStore({
    reducer,
    preloadedState,
  });
}

function normalizeError(error) {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }
  return {
    code: "network_error",
    message: "Не удалось подключиться к серверу.",
    fields: null,
  };
}

export const store = createAppStore();
