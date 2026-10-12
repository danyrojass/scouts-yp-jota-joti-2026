export type Principal =
  | {
      type: "admin";
      user: { id: string; username: string; role: "ADMIN" };
    }
  | {
      type: "team";
      team: {
        id: string;
        name: string;
        username: string;
        eventId: string;
      };
      eventName: string;
    };

export type EventStatus = "PREPARED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
export type ChallengeType = "CODE" | "QUESTION" | "CONFIRMATION" | "AUTO";
export type VisitStatus = "VALID" | "INCORRECT";

export type AuthResult = { principal: Principal; csrfToken: string | null };

export type EventItem = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  _count: { teams: number; stations: number; visits: number };
};

export type TeamItem = {
  id: string;
  eventId: string;
  name: string;
  username: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  routeStops: { id: string; position: number; stationId: string; question?: string | null; questionAnswer?: string | null }[];
  _count?: { visits: number };
};

export type StationItem = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  publicToken: string;
  challengeType: ChallengeType;
  instructions: string | null;
  displayedCode: string | null;
  expectedAnswer?: string | null;
  autoAcceptAny: boolean;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Progress = {
  total: number;
  completed: number;
  done: boolean;
  nextStationId: string | null;
  nextPosition: number | null;
  startAt: string | null;
  finishAt: string | null;
  visitedStations: string[];
};

export type PassportStop = {
  position: number;
  stationId: string;
  name: string;
  challengeType: ChallengeType;
  completed: boolean;
  completedAt: string | null;
  lastAttemptAt: string | null;
  attempts: number;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
};

export type Passport = {
  team: { id: string; name: string; username: string };
  event: { id: string; name: string; status: EventStatus };
  progress: Progress;
  stops: PassportStop[];
  history: {
    id: string;
    stationId: string;
    stationName: string | null;
    visitedAt: string;
    status: VisitStatus;
    isCorrect: boolean | null;
    attemptNumber: number;
  }[];
};

export type StationChallengeResponse =
  | { status: "NEXT"; station: { id: string; name: string; description: string | null; instructions: string | null; challengeType: ChallengeType; autoAcceptAny: boolean; displayedCode: string | null } }
  | { status: "COMPLETED" }
  | { status: "NOT_YOUR_NEXT" }
  | { status: "INACTIVE" }
  | { status: "EVENT_NOT_READY" }
  | { status: "EVENT_FINISHED" }
  | { status: "EVENT_CANCELLED" }
  | { status: "WRONG_EVENT" };

export type VisitResult =
  | {
      result: "VALID";
      message: string;
      nextStation: { id: string; name: string; position: number } | null;
      remaining: number;
    }
  | { result: "INCORRECT"; message: string; attemptNumber: number }
  | {
      result:
        | "ALREADY_COMPLETED"
        | "NOT_YOUR_NEXT"
        | "EVENT_NOT_READY"
        | "EVENT_FINISHED"
        | "EVENT_CANCELLED"
        | "INACTIVE"
        | "WRONG_EVENT";
      message: string;
    };

export type Dashboard = {
  event: { id: string; name: string; status: EventStatus; date: string };
  counts: {
    teams: number;
    activeTeams: number;
    stations: number;
    visits: number;
    teamsStarted: number;
    teamsInProgress: number;
    teamsFinished: number;
    teamsNotStarted: number;
  };
  teams: {
    teamId: string;
    team: string;
    username: string;
    active: boolean;
    totalStops: number;
    completed: number;
    done: boolean;
    nextStation: string | null;
    lastActivity: string | null;
    startAt: string | null;
    finishAt: string | null;
    status: "FINALIZADO" | "EN_RECORRIDO" | "NO_INICIADO" | "INACTIVO";
    correctAnswers: number;
    wrongAnswers: number;
  }[];
  lastVisits: {
    id: string;
    teamId: string;
    team: string;
    stationId: string;
    station: string;
    visitedAt: string;
    status: VisitStatus;
    isCorrect: boolean | null;
    attemptNumber: number;
  }[];
};

export type SafariTeamItem = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  found: boolean;
  foundAt: string | null;
};

export type TeamSafari = {
  team: { id: string; name: string };
  event: { id: string; name: string; status: EventStatus };
  safari: { id: string; title: string; description: string | null; active: boolean } | null;
  items: SafariTeamItem[];
  progress: { total: number; found: number; done: boolean; percent: number };
};

export type AdminSafariItem = {
  id: string;
  safariId: string;
  name: string;
  description: string | null;
  position: number;
  active: boolean;
};

export type AdminSafari = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  active: boolean;
  items: AdminSafariItem[];
};

export type SafariProgressReport = {
  safari: { id: string; title: string; description: string | null; active: boolean };
  counts: { items: number; activeItems: number; teams: number; teamsCompleted: number };
  teams: {
    teamId: string;
    team: string;
    active: boolean;
    found: number;
    total: number;
    done: boolean;
    percent: number;
  }[];
  items: { id: string; name: string; position: number; active: boolean; teams: number }[];
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  actorType: string;
  createdAt: string;
  user: { username: string } | null;
  team: { name: string } | null;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function errorMessage(err: unknown, fallback = "Algo salio mal") {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) {
    if (err.message.includes("failed to fetch")) return "No se pudo conectar con el servidor.";
    return err.message;
  }
  return fallback;
}