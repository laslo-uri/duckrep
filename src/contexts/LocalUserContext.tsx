import { createContext, useContext, type ReactNode } from 'react';
import { LOCAL_USER_ID } from '../lib/db';

export interface LocalUser {
  id: string;
  displayName: string;
}

interface LocalUserContextType {
  user: LocalUser;
  loading: boolean;
}

const defaultUser: LocalUser = { id: LOCAL_USER_ID, displayName: 'You' };

const LocalUserContext = createContext<LocalUserContextType>({
  user: defaultUser,
  loading: false,
});

export function LocalUserProvider({ children }: { children: ReactNode }) {
  return (
    <LocalUserContext.Provider value={{ user: defaultUser, loading: false }}>
      {children}
    </LocalUserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with provider
export function useLocalUser() {
  return useContext(LocalUserContext);
}
