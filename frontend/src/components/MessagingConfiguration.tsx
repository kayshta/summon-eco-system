import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-toastify';

interface MessagingConfigurationProps {
  onClose: () => void;
}

export default function MessagingConfiguration({ onClose }: MessagingConfigurationProps) {
  const queryClient = useQueryClient();
  const [activeProvider, setActiveProvider] = useState<'twilio' | 'textlink'>('twilio');
  const [twilioConfig, setTwilioConfig] = useState({
    accountSid: '',
    authToken: '',
    whatsappFrom: '',
    whatsappToPrefix: 'whatsapp:'
  });
  const [textlinkConfig, setTextlinkConfig] = useState({
    apiKey: '',
    apiUrl: 'https://textlinksms.com/api/send-sms',
    simCardId: ''
  });
  const [authTokenEdited, setAuthTokenEdited] = useState(false);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);

  const { data: messagingConfig, isLoading: messagingLoading } = useQuery({
    queryKey: ['messaging-config'],
    queryFn: async () => {
      const response = await api.get('/summon/messaging-config');
      return response.data;
    }
  });

  const { data: savedTwilioConfig, isLoading: twilioConfigLoading } = useQuery({
    queryKey: ['twilio-config'],
    queryFn: async () => {
      const response = await api.get('/summon/twilio-config');
      return response.data;
    }
  });

  const { data: savedTextlinkConfig, isLoading: textlinkConfigLoading } = useQuery({
    queryKey: ['textlink-config'],
    queryFn: async () => {
      const response = await api.get('/summon/textlink-config');
      return response.data;
    }
  });

  useEffect(() => {
    if (messagingConfig?.provider) {
      setActiveProvider(messagingConfig.provider);
    }
  }, [messagingConfig]);

  useEffect(() => {
    if (savedTwilioConfig) {
      setTwilioConfig({
        accountSid: savedTwilioConfig.accountSid || '',
        authToken: '',
        whatsappFrom: savedTwilioConfig.whatsappFrom || '',
        whatsappToPrefix: savedTwilioConfig.whatsappToPrefix || 'whatsapp:'
      });
      setAuthTokenEdited(false);
    }
  }, [savedTwilioConfig]);

  useEffect(() => {
    if (savedTextlinkConfig) {
      setTextlinkConfig({
        apiKey: '',
        apiUrl: savedTextlinkConfig.apiUrl || 'https://textlinksms.com/api/send-sms',
        simCardId: savedTextlinkConfig.simCardId || ''
      });
      setApiKeyEdited(false);
    }
  }, [savedTextlinkConfig]);

  const saveProviderMutation = useMutation({
    mutationFn: async (provider: 'twilio' | 'textlink') => {
      const response = await api.put('/summon/messaging-config', { provider });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Messaging provider updated');
      queryClient.invalidateQueries({ queryKey: ['messaging-config'] });
      queryClient.invalidateQueries({ queryKey: ['twilio-message-quota'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update messaging provider');
      if (messagingConfig?.provider) {
        setActiveProvider(messagingConfig.provider);
      }
    }
  });

  const saveTwilioConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put('/summon/twilio-config', {
        accountSid: twilioConfig.accountSid,
        authToken: twilioConfig.authToken,
        whatsappFrom: twilioConfig.whatsappFrom,
        whatsappToPrefix: twilioConfig.whatsappToPrefix,
        updateAuthToken: authTokenEdited
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Twilio configuration saved');
      setAuthTokenEdited(false);
      setTwilioConfig((current) => ({ ...current, authToken: '' }));
      queryClient.invalidateQueries({ queryKey: ['twilio-config'] });
      queryClient.invalidateQueries({ queryKey: ['twilio-message-quota'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save Twilio configuration');
    }
  });

  const saveTextlinkConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put('/summon/textlink-config', {
        apiKey: textlinkConfig.apiKey,
        apiUrl: textlinkConfig.apiUrl,
        simCardId: textlinkConfig.simCardId,
        updateApiKey: apiKeyEdited
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('TextLink configuration saved');
      setApiKeyEdited(false);
      setTextlinkConfig((current) => ({ ...current, apiKey: '' }));
      queryClient.invalidateQueries({ queryKey: ['textlink-config'] });
      queryClient.invalidateQueries({ queryKey: ['twilio-message-quota'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save TextLink configuration');
    }
  });

  const handleProviderChange = (provider: 'twilio' | 'textlink') => {
    setActiveProvider(provider);
    saveProviderMutation.mutate(provider);
  };

  const isLoading = messagingLoading || twilioConfigLoading || textlinkConfigLoading;

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Messaging Configuration</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <p style={{ marginBottom: '16px', color: '#666' }}>
        Choose Twilio or TextLink for student call notifications. Each provider has its own API settings below.
      </p>

      <div className="form-group">
        <label>Active Messaging Provider</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${activeProvider === 'twilio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleProviderChange('twilio')}
            disabled={saveProviderMutation.isPending}
          >
            Twilio
          </button>
          <button
            type="button"
            className={`btn ${activeProvider === 'textlink' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleProviderChange('textlink')}
            disabled={saveProviderMutation.isPending}
          >
            TextLink
          </button>
          <span className="badge badge-info">
            Active: {activeProvider === 'textlink' ? 'TextLink' : 'Twilio'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <p>Loading configuration...</p>
      ) : (
        <>
          <div
            style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #eee',
              opacity: activeProvider === 'twilio' ? 1 : 0.75
            }}
          >
            <h3 style={{ marginTop: 0 }}>Twilio Configuration</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveTwilioConfigMutation.mutate();
              }}
            >
              <div className="form-group">
                <label htmlFor="twilio-account-sid">Twilio Account SID *</label>
                <input
                  id="twilio-account-sid"
                  type="text"
                  value={twilioConfig.accountSid}
                  onChange={(e) => setTwilioConfig({ ...twilioConfig, accountSid: e.target.value })}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="twilio-auth-token">Twilio Auth Token *</label>
                <input
                  id="twilio-auth-token"
                  type="password"
                  value={twilioConfig.authToken}
                  onChange={(e) => {
                    setTwilioConfig({ ...twilioConfig, authToken: e.target.value });
                    setAuthTokenEdited(true);
                  }}
                  placeholder={
                    savedTwilioConfig?.hasAuthToken
                      ? `Configured (${savedTwilioConfig.authTokenMasked})`
                      : 'Enter auth token'
                  }
                  className="form-input"
                />
                {savedTwilioConfig?.hasAuthToken && !authTokenEdited && (
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                    Leave blank to keep the current token.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="twilio-whatsapp-from">WhatsApp From *</label>
                <input
                  id="twilio-whatsapp-from"
                  type="text"
                  value={twilioConfig.whatsappFrom}
                  onChange={(e) => setTwilioConfig({ ...twilioConfig, whatsappFrom: e.target.value })}
                  placeholder="whatsapp:+14155238886"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="twilio-whatsapp-to-prefix">WhatsApp To Prefix *</label>
                <input
                  id="twilio-whatsapp-to-prefix"
                  type="text"
                  value={twilioConfig.whatsappToPrefix}
                  onChange={(e) => setTwilioConfig({ ...twilioConfig, whatsappToPrefix: e.target.value })}
                  placeholder="whatsapp:"
                  className="form-input"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={saveTwilioConfigMutation.isPending}
              >
                {saveTwilioConfigMutation.isPending ? 'Saving...' : 'Save Twilio Settings'}
              </button>
            </form>
          </div>

          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid #eee',
              opacity: activeProvider === 'textlink' ? 1 : 0.75
            }}
          >
            <h3 style={{ marginTop: 0 }}>TextLink Configuration</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!savedTextlinkConfig?.hasApiKey && !textlinkConfig.apiKey.trim()) {
                  toast.error('TextLink API key is required');
                  return;
                }
                saveTextlinkConfigMutation.mutate();
              }}
            >
              <div className="form-group">
                <label htmlFor="textlink-api-key">TextLink API Key *</label>
                <input
                  id="textlink-api-key"
                  type="password"
                  value={textlinkConfig.apiKey}
                  onChange={(e) => {
                    setTextlinkConfig({ ...textlinkConfig, apiKey: e.target.value });
                    setApiKeyEdited(true);
                  }}
                  placeholder={
                    savedTextlinkConfig?.hasApiKey
                      ? `Configured (${savedTextlinkConfig.apiKeyMasked})`
                      : 'Enter API key from TextLink dashboard'
                  }
                  className="form-input"
                />
                {savedTextlinkConfig?.hasApiKey && !apiKeyEdited && (
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                    Leave blank to keep the current API key.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="textlink-api-url">TextLink API URL *</label>
                <input
                  id="textlink-api-url"
                  type="url"
                  value={textlinkConfig.apiUrl}
                  onChange={(e) => setTextlinkConfig({ ...textlinkConfig, apiUrl: e.target.value })}
                  placeholder="https://textlinksms.com/api/send-sms"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="textlink-sim-card-id">SIM Card ID (optional)</label>
                <input
                  id="textlink-sim-card-id"
                  type="text"
                  value={textlinkConfig.simCardId}
                  onChange={(e) => setTextlinkConfig({ ...textlinkConfig, simCardId: e.target.value })}
                  placeholder="Device SIM card ID from TextLink dashboard"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={saveTextlinkConfigMutation.isPending}
              >
                {saveTextlinkConfigMutation.isPending ? 'Saving...' : 'Save TextLink Settings'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
