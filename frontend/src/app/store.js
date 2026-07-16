import { configureStore, createSlice } from "@reduxjs/toolkit";

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

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    users: usersSlice.reducer,
    files: filesSlice.reducer,
  },
});
