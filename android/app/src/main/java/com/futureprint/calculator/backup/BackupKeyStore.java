package com.futureprint.calculator.backup;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Log;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/**
 * Owns the AES-256 backup key.
 *
 * Security decisions:
 *  - The key lives ONLY in the app's (device-protected-safe) SharedPreferences,
 *    never in the backup folder, so a leaked SD card or a shared cloud folder
 *    does not expose plaintext data.
 *  - It is wrapped with an Android Keystore AES key when one is available
 *    (API 23+ always has one on real devices, but it can be unavailable on
 *    some emulator images), so the at-rest key material is useless without
 *    the hardware-backed wrapping key.
 *  - Loss of this key (data clear, reinstall) is a known, documented limitation:
 *    the UI warns the user and offers a passphrase export to survive it.
 */
final class BackupKeyStore {

    private static final String TAG = "BackupKeyStore";
    private static final String PREFS = "ta_backup_keystore";
    private static final String KEY_WRAPPED = "wrapped_key";
    private static final String KEY_PLAIN = "plain_key";
    private static final String KEY_ID = "key_id";
    private static final String ANDROID_KEY_ALIAS = "ta_backup_wrap_key_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private final Context context;
    private final SecureRandom random = new SecureRandom();

    BackupKeyStore(Context context) {
        this.context = context.getApplicationContext();
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Returns the active key, creating one on first use. */
    synchronized byte[] getOrCreateKey() {
        byte[] existing = getExistingKey();
        if (existing != null) return existing;
        byte[] fresh = new byte[BackupArchive.KEY_LEN];
        random.nextBytes(fresh);
        storeKey(fresh);
        return fresh;
    }

    /** Returns the key, or null when this install has no key yet. */
    synchronized byte[] getExistingKey() {
        SharedPreferences p = prefs();
        String wrapped = p.getString(KEY_WRAPPED, null);
        if (wrapped != null) {
            try {
                return unwrap(Base64.decode(wrapped, Base64.NO_WRAP));
            } catch (Exception e) {
                Log.e(TAG, "Stored backup key could not be unwrapped; treating as missing", e);
                return null;
            }
        }
        String plain = p.getString(KEY_PLAIN, null);
        if (plain != null) {
            try {
                return Base64.decode(plain, Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    /** Wraps `key` with the Android Keystore key and persists it atomically. */
    synchronized String storeKey(byte[] key) {
        if (key == null || key.length != BackupArchive.KEY_LEN) throw new IllegalArgumentException("backup key must be 32 bytes");
        String keyId = BackupArchive.deriveKeyId(key);
        SharedPreferences.Editor editor = prefs().edit();
        try {
            byte[] sealed = wrap(key);
            editor.putString(KEY_WRAPPED, Base64.encodeToString(sealed, Base64.NO_WRAP)).remove(KEY_PLAIN);
        } catch (Exception e) {
            Log.w(TAG, "Keystore wrapping unavailable, storing key in private prefs", e);
            editor.putString(KEY_PLAIN, Base64.encodeToString(key, Base64.NO_WRAP)).remove(KEY_WRAPPED);
        }
        editor.putString(KEY_ID, keyId);
        if (!editor.commit()) throw new IllegalStateException("تعذّر حفظ مفتاح التشفير.");
        return keyId;
    }

    synchronized String getKeyId() {
        return prefs().getString(KEY_ID, null);
    }

    synchronized void clear() {
        prefs().edit().clear().commit();
    }

    private SecretKey getOrCreateWrappingKey() throws GeneralSecurityException {
        java.security.KeyStore ks = java.security.KeyStore.getInstance("AndroidKeyStore");
        try {
            ks.load(null);
            if (ks.containsAlias(ANDROID_KEY_ALIAS)) {
                java.security.Key k = ks.getKey(ANDROID_KEY_ALIAS, null);
                if (k instanceof SecretKey) return (SecretKey) k;
            }
            KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(
                ANDROID_KEY_ALIAS,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
            return generator.generateKey();
        } catch (Exception e) {
            throw new GeneralSecurityException("AndroidKeyStore unavailable", e);
        }
    }

    private byte[] wrap(byte[] key) throws Exception {
        SecretKey wrappingKey = getOrCreateWrappingKey();
        byte[] iv = new byte[BackupArchive.GCM_IV_LEN];
        random.nextBytes(iv);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance(TRANSFORMATION);
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, wrappingKey, new javax.crypto.spec.GCMParameterSpec(128, iv));
        byte[] body = cipher.doFinal(key);
        byte[] out = new byte[iv.length + body.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(body, 0, out, iv.length, body.length);
        return out;
    }

    private byte[] unwrap(byte[] wrapped) throws Exception {
        SecretKey wrappingKey = getOrCreateWrappingKey();
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance(TRANSFORMATION);
        cipher.init(
            javax.crypto.Cipher.DECRYPT_MODE,
            wrappingKey,
            new javax.crypto.spec.GCMParameterSpec(128, wrapped, 0, BackupArchive.GCM_IV_LEN)
        );
        return cipher.doFinal(wrapped, BackupArchive.GCM_IV_LEN, wrapped.length - BackupArchive.GCM_IV_LEN);
    }

    /** True when the platform Keystore can wrap keys (drives the UI capability flag). */
    boolean isKeystoreAvailable() {
        try {
            getOrCreateWrappingKey();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
