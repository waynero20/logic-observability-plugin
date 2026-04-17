import 'package:flutter_riverpod/flutter_riverpod.dart';

// Riverpod provider
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthNotifier(apiClient);
});

final currentUserProvider = FutureProvider<User?>((ref) {
  final authState = ref.watch(authStateProvider);
  if (authState.isAuthenticated) {
    return ref.read(apiClientProvider).fetchCurrentUser();
  }
  return null;
});

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(AuthState.initial());

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true);

    try {
      final token = await _api.authenticate(email, password);
      if (token == null) {
        state = state.copyWith(isLoading: false, error: 'Invalid credentials');
        return false;
      }

      await _api.storeToken(token);
      final user = await _api.fetchCurrentUser();

      if (user.isBlocked) {
        await _api.revokeToken(token);
        state = state.copyWith(isLoading: false, error: 'Account blocked');
        return false;
      }

      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: user,
        token: token,
      );
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await _api.revokeToken(state.token!);
    await _api.clearStorage();
    state = AuthState.initial();
  }

  Future<void> refreshProfile() async {
    final user = await _api.fetchCurrentUser();
    state = state.copyWith(user: user);
  }
}
