import { configureStore, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { ApiError, getCurrentUser } from "../api/apiClient.js";

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
});

const filesSlice = createSlice({
  name: "files",
  initialState: {
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
